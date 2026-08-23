## Why

Everything the user has entered lives in AsyncStorage on one device, with no
copy anywhere. After `add-rapid-scan-mode`, bootstrapping a pantry is an hour of
scanning — an hour that a reinstall, a lost phone, or "clear website data" on
web erases without warning and without recourse.

The roadmap in `add-pantry-inventory` put this at 4 with the note "only urgent
once there is hand-entered data worth losing". That condition is now met: the
scan session is real data on one device with no backup.

It is also the cheapest insurance in the roadmap. Changes 5–7 all add data —
consumption events, shelf lives, re-buy opt-ins — and each one is more expensive
to lose than the last. Doing this before them means everything after it is
covered from the day it ships.

## What Changes

- A **backup file**: the whole pantry as one JSON document — entries, catalogue
  and locations, with a format version and an export timestamp.
- **Export**, delivered by the platform's own mechanism: the share sheet on iOS
  (Save to Files, AirDrop, Mail), a file download on web. Works offline.
- **Import**, which validates the file completely before touching stored data,
  then replaces the pantry wholesale behind an explicit confirmation.
- **Validation treats the file as untrusted**, on the same terms as an Open Food
  Facts response: parsed as `unknown` and checked field by field. A backup can
  be hand-edited, truncated by a failed transfer, or simply be some other JSON
  file the user picked by mistake.
- **Referential integrity is repaired rather than assumed** — an entry pointing
  at a catalogue key or location that the file does not contain is handled and
  reported, not silently loaded into a broken state.
- A new `/backup` route, reached from the pantry header alongside `Places`.

**Not in this change:** merging a backup into existing data, automatic or
scheduled backups, cloud storage, and CSV or any human-editable format. All are
noted in design.md with the reasoning.

## Capabilities

### New Capabilities

- `pantry-backup`: producing a complete, portable copy of the user's pantry and
  restoring from one, including how an untrusted or damaged file is handled.

### Modified Capabilities

None. Export and import are additive — no existing requirement changes. The
round-trip requirement constrains the *file*, not the pantry model, so `pantry`,
`pantry-entry-creation` and `product-catalogue` are untouched.

## Impact

**Added**: `src/lib/backup.ts` — build and validate the backup document, pure
and directly testable, in the same spirit as `src/lib/quantity.ts`. A
`RESTORE_BACKUP` action in `pantryReducer.ts`. `src/screens/BackupScreen.tsx`
and `app/backup.tsx`. `src/lib/backupFile.ts` for the platform I/O, which is the
only impure part.

**Modified**: `PantryStore.tsx` gains `restoreBackup`, and exposes the raw state
needed to build a backup. `PantryScreen.tsx` gains one header link.

**Dependencies**: `expo-file-system`, `expo-sharing` and `expo-document-picker`
— all first-party Expo modules bundled in Expo Go, so no dev build. `expo-sharing`
is native-only; the web download path uses a Blob and needs nothing.

**Unchanged**: the reducer's existing actions, the merge rule, the API layer,
and the offline product cache, which is deliberately not part of a backup.

**Prerequisite**: none beyond what has shipped. This change reads the state that
`add-pantry-inventory` established.
