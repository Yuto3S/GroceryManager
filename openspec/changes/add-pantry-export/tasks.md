## 1. Dependencies

- [ ] 1.1 Install `expo-file-system`, `expo-sharing` and `expo-document-picker`
      at versions that have passed the 7-day cooldown, and verify
      `pnpm install --frozen-lockfile` succeeds with no build-script prompt
- [ ] 1.2 Confirm all three resolve to `registry.npmjs.org` in `pnpm-lock.yaml`
      and verify `pnpm audit` reports no new advisory
- [ ] 1.3 Record the version choices in SECURITY.md alongside the existing
      cooldown pins, and verify the note names each version and its publish date

## 2. The backup document

- [ ] 2.1 Add `Backup` and the format constants to `src/lib/backup.ts`, and
      verify `pnpm run typecheck` passes
- [ ] 2.2 Implement `buildBackup(entries, catalogue, locations, now)` and verify
      a test asserts the cache and scan session are absent while tombstoned
      entries and locations are present
- [ ] 2.3 Implement filename generation and verify a test asserts two backups
      taken on different days produce different names

## 3. Validation

- [ ] 3.1 Implement `parseBackup(raw: unknown)` returning a discriminated
      success/failure result, taking `unknown` and never asserting a shape, and
      verify a test covers non-JSON, a JSON array, a JSON object without the
      format marker, and a truncated document
- [ ] 3.2 Reject a `version` greater than the supported one with a distinct
      reason, and verify a test asserts the reason names the version
- [ ] 3.3 Validate each record field by field, dropping malformed records rather
      than the file, and verify tests cover a missing `id`, a non-numeric
      `amount`, a bad `unit`, and a non-`YYYY-MM-DD` `expiresAt`
- [ ] 3.4 Verify with a test that a rejected file produces no partial output of
      any kind

## 4. Referential repair

- [ ] 4.1 Reassign entries whose `locationId` is absent from the backup to the
      first available location, and verify a test asserts the entry is imported
      and the repair is reported
- [ ] 4.2 Drop entries whose `productKey` has no catalogue record, and verify a
      test asserts the entry is absent and reported as dropped
- [ ] 4.3 Seed locations when the backup contains none, and verify a test
      asserts entries land in a seeded location
- [ ] 4.4 Return an `ImportReport` carrying restored counts, dropped records and
      repairs, and verify a test asserts a clean import reports zero of each

## 5. Restoring into state

- [ ] 5.1 Add `RESTORE_BACKUP` to `pantryReducer.ts`, replacing entries,
      catalogue and locations wholesale while leaving `productCache` alone, and
      verify a test asserts pre-existing entries absent from the backup are gone
- [ ] 5.2 Verify with a test that `RESTORE_BACKUP` copies `id`, `createdAt`,
      `updatedAt` and `deletedAt` verbatim and does not renumber or clamp them
- [ ] 5.3 Expose `restoreBackup` from `PantryStore.tsx`, supplying `now` and any
      seeded location ids, and verify `pnpm run typecheck` passes
- [ ] 5.4 Verify with a test that a build → parse → restore round trip through
      the reducer reproduces the original entries, catalogue and locations
      exactly, tombstones included

## 6. Platform I/O

- [ ] 6.1 Implement `writeBackupFile(json, filename)` in `src/lib/backupFile.ts`
      with the native path writing to the cache directory then sharing, and
      verify it against the installed `expo-file-system` SDK 57 API
- [ ] 6.2 Implement the web path as a Blob download that revokes its object URL,
      and verify the downloaded file opens as valid JSON
- [ ] 6.3 Implement `readBackupFile()` over `expo-document-picker` on both
      platforms and verify a cancelled picker returns a cancelled result rather
      than throwing
- [ ] 6.4 Gate export on `Sharing.isAvailableAsync()` on native and verify the
      control is hidden, not inert, where sharing is unavailable

## 7. The screen

- [ ] 7.1 Add `src/screens/BackupScreen.tsx` and `app/backup.tsx`, and verify
      `/backup` renders under `pnpm exec expo start --web`
- [ ] 7.2 Link to it from the pantry header beside `Places`, and verify a test
      asserts the link is present
- [ ] 7.3 Show the export control with the current pantry counts, and verify a
      test asserts the counts match the store
- [ ] 7.4 Implement the import confirmation panel showing the backup's
      `exportedAt` in local time, its counts, and the counts about to be
      replaced, and verify a test asserts nothing is dispatched before
      confirmation
- [ ] 7.5 Show the rejection reason for an invalid file without leaving the
      screen, and verify a test asserts the pantry is untouched
- [ ] 7.6 Show the `ImportReport` after a successful import, including drops and
      repairs, and verify a test asserts a repair is displayed

## 8. Verification

- [ ] 8.1 Run `pnpm run check` and `pnpm test` and verify both pass
- [ ] 8.2 On iOS Expo Go: export, save to Files, delete the app's data, reinstall
      and import — verify the pantry comes back with counts matching
- [ ] 8.3 On web: export downloads a file, and importing that file into a
      browser with different data replaces it — verify the confirmation states
      the correct counts first
- [ ] 8.4 Import a deliberately corrupted backup on device and verify the app
      still starts and the pantry is unchanged
- [ ] 8.5 Cross-platform: export from the phone and import into the browser, and
      verify the round trip holds across platforms
