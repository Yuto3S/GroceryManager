## Context

See proposal.md — Why. Requirements are in `specs/`.

This change adds no domain concepts. A backup is a serialisation of state that
already exists, and the interesting work is all in the two places where that
state meets the outside world: **what a file is allowed to do to the pantry when
it comes back in**, and **how a file gets out of the app on two platforms that
have nothing in common about it**.

## Goals / Non-Goals

**Goals:**

- A file that comes to rest outside the app, on both iOS and web.
- An import that cannot corrupt stored data, whatever the file contains.
- A round trip that loses nothing — identities and tombstones included.

**Non-Goals:**

- Merging a backup into an existing pantry. See Decisions.
- Automatic, scheduled or cloud backups.
- A human-editable format (CSV, one file per entry). See Decisions.
- Backing up the offline product cache or an in-progress scan session.

## Decisions

### Restore replaces; it does not merge

```
   Backup ─────────────▶ [ replace ] ─────────────▶ Pantry
                              ▲
                              │
                    everything that was there
                    is gone, and the user was
                    told so before confirming
```

Restore exists for the case where there is nothing to merge with: a new phone, a
reinstall, a browser whose storage was cleared. In that case replace and merge
are the same operation, and replace is the one with no ambiguity in it.

Merge is a different feature wearing this one's clothes. Doing it properly means
per-record conflict resolution — the pantry has UUIDs, `updatedAt` and
tombstones precisely so that stays possible — and doing it improperly means
duplicating half a pantry with no way back. `Tracked` keeps the door open; this
change does not walk through it.

The cost is that importing onto a device with data is destructive. That is
mitigated by stating what will be lost, with counts, before anything happens —
not by a softer default, which would just make the destruction quieter.

### JSON, matching the persisted shape

The file is the four storage slices, minus the cache:

```
  {
    "format": "grocery-scanner.pantry",
    "version": 1,
    "exportedAt": 1756000000000,
    "entries":   { id -> PantryEntry },
    "catalogue": { key -> CatalogueEntry },
    "locations": { id -> Location }
  }
```

Keyed maps rather than arrays, because that is how they are stored and how the
reducer holds them: an array would have to be rebuilt into a map on both sides,
which is two more places to drop a record. `format` is there so that a JSON file
that happens to have an `entries` key is still rejected.

`version` is a single integer for the whole document. Per-slice versioning would
let a future change migrate one slice independently, which sounds useful and
never is — the slices reference each other, so they version together.

Rejected: **CSV**. It cannot express three related maps, it would force a
flattened row shape that loses tombstones and identities, and its only real
advantage — editing in a spreadsheet — is an advantage for a feature this change
does not have. Rejected: **one file per record**, which needs a container format
to transfer and buys nothing over one JSON document.

### Validation is a checked parse, not a cast

Same rule as `src/api/openFoodFacts.ts`, for the same reason. `JSON.parse`
returns `unknown` and stays `unknown` until each field has been checked. Typing
the parse result as a backup would be an assertion that the file is well-formed,
which is exactly the claim that cannot be made about a file the user picked out
of their filesystem.

Two failure modes are distinguished, because they call for different responses:

```
  structural   the document is not a backup at all — bad JSON, wrong
               format marker, a version from the future, a slice that is
               not an object.
               ──▶ reject the whole file, change nothing, say why.

  per-record   the document is a backup, but one record inside it is
               malformed or points at something absent.
               ──▶ drop or repair that record, import the rest, and
                   report it.
```

Rejecting the whole file for one bad record would mean a single corrupted entry
costs the user their entire pantry. Silently dropping a slice would mean they
believe they restored something they did not. Hence: drop the record, keep the
file, and say what happened.

### Referential repair has an asymmetry, on purpose

An entry refers to a catalogue record and to a location. The two are not
equally recoverable:

```
  missing location   ──▶ reassign to the first available location.
                         An entry in the wrong place is still your
                         yoghurt. The user can move it.

  missing product    ──▶ drop the entry.
                         An entry whose catalogue record is gone has no
                         name, no unit, no defaults. There is nothing to
                         show and nothing to move.
```

If a backup has no locations at all, the seed locations are created, as on a
fresh install — so there is always somewhere for the reassignment to land, and
the "no locations" case never has to be special-cased downstream.

Both repairs are reported. An unreported repair is a lie about what was
restored, and this is the one feature where the user's trust in the report is
the whole product.

### `RESTORE_BACKUP` is a reducer action

Restore is a state transition, so it belongs where every other state transition
lives — in the pure reducer, testable without rendering anything or touching
storage. The provider keeps its existing job: it supplies `now`, supplies fresh
UUIDs for any seeded locations, and lets the existing per-slice `usePersist`
effects write the result. No new storage code, and no path that writes to
AsyncStorage without going through the reducer first.

The repair itself happens in `src/lib/backup.ts` before the action is
dispatched, so the reducer receives an already-consistent state and the repair
report is available to the screen. Repair is a property of the file, not of the
pantry, which is what puts it on that side of the boundary.

### Platform I/O is isolated and forked once

There is no shared mechanism for "give the user a file" across iOS and web, so
pretending otherwise would mean an abstraction with one honest implementation
and one that lies. Instead, `src/lib/backupFile.ts` holds one `Platform.OS`
fork with both paths visible:

```
              write                          read
            ┌────────────────────┐        ┌────────────────────────┐
  native    │ file-system → temp │        │ document-picker → uri  │
            │ sharing.shareAsync │        │ file-system read       │
            └────────────────────┘        └────────────────────────┘
            ┌────────────────────┐        ┌────────────────────────┐
  web       │ Blob → <a download>│        │ document-picker (input)│
            │ revoke object URL  │        │ fetch(blob uri).text() │
            └────────────────────┘        └────────────────────────┘
```

Everything above this module is platform-agnostic and deals in strings, which is
also what makes the whole of `backup.ts` testable under Jest with no native
mocks at all.

`expo-sharing` reports its own availability; where it says no, export is not
offered, on the same principle as the web scanning gate — a control that does
nothing is worse than an absent one.

### The temp file is written to the cache directory

The share sheet needs a real file URI, so export writes one before sharing it.
It goes in the cache directory rather than the document directory: the OS may
reclaim it, which is correct, because the copy that matters is the one the user
saved from the share sheet. A backup accumulating in app storage would be a
backup that dies with the app.

### Entry point: a second link in the pantry header

`/backup`, alongside the existing `Places` link. A settings screen to hold both
would be the tidier structure and is not yet earned by two items; putting backup
behind an extra tap on the strength of a hypothetical third one makes the
feature harder to find for no present gain.

## Risks / Trade-offs

- **Import is destructive and the confirmation is the only guard.** → State the
  counts of what is about to be lost, not a generic "are you sure". Users click
  through generic warnings; they read numbers about their own data.

- **A user could restore a months-old backup and lose recent work.** → The
  backup's own `exportedAt` is shown in the confirmation, in the user's local
  time. Age is the fact most likely to change their mind, so it belongs in front
  of them at the moment of decision.

- **Timestamps are epoch milliseconds and survive the round trip untouched.**
  Deriving anything from them at import — clamping to now, renumbering — would
  break the round-trip requirement and destroy the ordering that a future sync
  depends on. Restore copies them verbatim.

- **Three new dependencies, all first-party Expo, all bundled in Expo Go.**
  → Under the 7-day cooldown some current patches are too new; install the
  matured versions, as with the router migration. `expo-document-picker` is the
  only one whose latest release is already matured.

- **A large pantry produces a large file.** A thousand entries is on the order of
  a few hundred kilobytes of JSON — fine for a share sheet or a download, and
  fine to hold in memory as a string. Streaming would be pure complexity at this
  size.

- **Export leaves a plaintext file with the user's data in it.** That is the
  point of the feature, and the pantry contains nothing sensitive. Worth stating
  so it is a decision rather than an oversight: no encryption, no password.

- **Web `<a download>` is blocked in some embedded browsers.** → The failure is
  visible (nothing downloads) rather than silent corruption, and the phone
  remains the primary path. Not worth a fallback until someone hits it.

## Open Questions

- ~~Whether the confirmation should be a native `Alert` or an in-screen
  panel.~~ **Resolved: an in-screen panel.** `Alert` is the platform idiom, but
  react-native-web implements it as `window.confirm`, which renders one string
  and no structure — and the counts are the whole point of the confirmation. A
  panel also keeps the backup's date and the repair report on screen next to
  the button, rather than in a modal the user has already dismissed.
- Whether a future change should keep the last N backups in app storage as a
  convenience. Deliberately out of scope here: it is a different guarantee, and
  a backup that lives inside the app does not survive the app being deleted.
