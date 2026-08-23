# pantry-backup Specification

## Purpose
Produces a complete, portable copy of everything the user has entered, and
restores from one, so that a lost device, a reinstall or cleared browser storage
costs the user a file transfer rather than an hour of rescanning.

## Requirements

### Requirement: A backup contains everything the user entered and nothing derived

The system SHALL be able to produce a single document containing the complete
pantry: every entry, every catalogue record and every location, including
records that have been removed and are held as tombstones.

Data the system can rebuild by itself SHALL NOT be included. A backup is a copy
of the user's work, not of the app's state.

#### Scenario: Everything the user entered is present

- **WHEN** a backup is produced from a pantry with entries, catalogue records
  and locations
- **THEN** all of them appear in the backup

#### Scenario: Removed records survive

- **WHEN** a backup is produced from a pantry containing a removed entry and a
  removed location
- **THEN** both appear in the backup, still marked as removed

#### Scenario: Rebuildable data is excluded

- **WHEN** a backup is produced
- **THEN** the offline product lookup cache is not part of it
- **AND** any scan session in progress is not part of it

### Requirement: A backup identifies its own format

Every backup SHALL carry a format version and the instant it was produced.

#### Scenario: Version and timestamp are present

- **WHEN** a backup is produced
- **THEN** it states its format version and when it was produced

### Requirement: Export works offline and needs no account

Producing and delivering a backup SHALL NOT require a network connection, a
sign-in, or any third-party service.

#### Scenario: Export with no network

- **WHEN** the user exports with no network connection
- **THEN** the backup is produced and delivered normally

### Requirement: The backup is delivered somewhere the user can keep it

Export SHALL hand the backup to the user through a mechanism their platform
provides for saving or sending a file, so that it comes to rest outside the app.

Showing the backup on screen is not delivery: the point is that it survives the
app being deleted.

#### Scenario: Delivery on a phone

- **WHEN** the user exports on a phone
- **THEN** they are offered the system's own means of saving or sending the file

#### Scenario: Delivery in a browser

- **WHEN** the user exports in a browser
- **THEN** the backup is downloaded as a file

#### Scenario: Delivery is cancelled

- **WHEN** the user dismisses the save or send step without completing it
- **THEN** nothing is changed and the user may export again

### Requirement: The file is named so backups can be told apart

An exported backup SHALL be named to identify it as a pantry backup and to
distinguish it from a backup taken at another time.

#### Scenario: Two backups on the same device

- **WHEN** the user exports twice on different days
- **THEN** the two files have different names

### Requirement: An import file is untrusted until validated

Import SHALL treat the chosen file as untrusted input and validate its entire
structure before any stored data is changed. A file that is not a valid backup
SHALL be rejected with a stated reason, and the existing pantry SHALL be left
exactly as it was.

The user can pick any file, a transfer can truncate one, and a backup can be
hand-edited. None of these SHALL be able to corrupt stored data or prevent the
app from starting.

#### Scenario: A file that is not JSON

- **WHEN** the user picks a file that is not valid JSON
- **THEN** import is refused with a reason
- **AND** the pantry is unchanged

#### Scenario: JSON that is not a backup

- **WHEN** the user picks a valid JSON file that is not a pantry backup
- **THEN** import is refused with a reason
- **AND** the pantry is unchanged

#### Scenario: A truncated backup

- **WHEN** the user picks a backup file that was cut off mid-transfer
- **THEN** import is refused with a reason
- **AND** the pantry is unchanged

#### Scenario: Records with the wrong shape are not loaded

- **WHEN** a backup contains a record whose fields are missing or of the wrong
  type
- **THEN** that record is not loaded as-is

#### Scenario: Validation happens before anything is written

- **WHEN** a backup is rejected during validation
- **THEN** no part of it has been written to storage

### Requirement: A backup from a future format version is refused

Import SHALL refuse a backup whose format version is newer than the one this
version of the app understands, and SHALL say so.

Loading it partially would be worse than refusing: the user would believe they
had restored a backup they had in fact discarded.

#### Scenario: Newer format

- **WHEN** the user imports a backup whose format version is newer than the app
  understands
- **THEN** import is refused, stating that the backup is from a newer version
- **AND** the pantry is unchanged

### Requirement: Import replaces the pantry, and says so before it does

Import SHALL replace all pantry data with the backup's contents. It SHALL NOT
merge with, or add to, what is already there.

Before replacing anything the system SHALL require an explicit confirmation
that states what is currently stored and will be lost.

#### Scenario: Confirmation states what is at stake

- **WHEN** the user has chosen a valid backup and the pantry currently holds
  items
- **THEN** they are told how much is currently stored and that it will be
  replaced
- **AND** nothing is changed until they confirm

#### Scenario: Declining the confirmation

- **WHEN** the user declines the confirmation
- **THEN** the pantry is unchanged

#### Scenario: Replacement is complete

- **WHEN** the user confirms an import
- **THEN** the pantry contains what the backup contained
- **AND** entries that existed before the import but not in the backup are gone

#### Scenario: Import survives a restart

- **WHEN** an import completes and the app is restarted
- **THEN** the imported data is still there

### Requirement: References inside a backup are repaired, not assumed

An entry in a backup refers to a catalogue record and to a location. Where such
a reference cannot be resolved within the same backup, import SHALL resolve it
to something valid rather than loading an entry that points at nothing, and
SHALL report each repair it made.

#### Scenario: An entry whose location is missing

- **WHEN** a backup contains an entry referring to a location the backup does
  not contain
- **THEN** the entry is imported into an existing location
- **AND** the repair is reported

#### Scenario: An entry whose product is missing

- **WHEN** a backup contains an entry referring to a catalogue record the
  backup does not contain
- **THEN** that entry is not imported
- **AND** it is reported as dropped

#### Scenario: A backup with no locations

- **WHEN** a backup contains entries but no locations at all
- **THEN** import still produces a usable pantry with at least one location

### Requirement: Import reports what it did

On completion, import SHALL report how much was restored, and everything that
was dropped or repaired. A repair SHALL NOT be silent.

#### Scenario: A clean import

- **WHEN** an import completes with nothing dropped or repaired
- **THEN** the counts of what was restored are reported

#### Scenario: An import with repairs

- **WHEN** an import completes having dropped two entries and reassigned one
- **THEN** all three are reported alongside the restored counts

### Requirement: Export and import round-trip without loss

Exporting a pantry and importing the resulting backup into an empty pantry SHALL
produce the same pantry, including record identities, timestamps and tombstones.

This is what makes the backup a backup rather than a summary.

#### Scenario: Round trip preserves the pantry

- **WHEN** a pantry is exported and the backup imported into an empty pantry
- **THEN** the resulting entries, catalogue records and locations are identical
  to the originals, identities and timestamps included

#### Scenario: Round trip preserves removals

- **WHEN** a pantry containing removed records is exported and re-imported
- **THEN** those records are still removed afterwards, and do not reappear
