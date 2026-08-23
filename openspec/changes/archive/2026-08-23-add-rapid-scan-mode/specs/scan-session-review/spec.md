## Purpose

Turns a finished scan session into pantry entries in one pass, putting the items
that actually need the user's attention in front of them and letting everything
else through on its defaults.

## ADDED Requirements

### Requirement: Review presents the session before anything is created

Ending a session SHALL open a review of everything scanned. No pantry entry SHALL
exist until the user confirms.

#### Scenario: Review lists the session

- **WHEN** the user ends a session of fourteen items
- **THEN** all fourteen are listed with their counts and resolved names

#### Scenario: Abandoning review

- **WHEN** the user leaves review without confirming
- **THEN** no pantry entries are created
- **AND** the session is still resumable

### Requirement: Items needing attention come first

Items that could not be resolved to a product SHALL be presented before resolved
items, and SHALL be identified as needing a name.

#### Scenario: Unresolved items surface

- **WHEN** a session contains two unresolved barcodes among twelve resolved items
- **THEN** the two unresolved items appear first
- **AND** the count of items needing attention is stated

#### Scenario: Naming an unresolved item

- **WHEN** the user supplies a name for an unresolved barcode
- **THEN** it is treated as a named product for the rest of review
- **AND** the barcode is retained so a later lookup can still resolve it

#### Scenario: Confirming with items still unnamed

- **WHEN** the user confirms while items remain unnamed
- **THEN** entries are still created, each identifiable as needing a name

### Requirement: Review items are editable before confirmation

The user SHALL be able to change any queued item's count, unit, consume step and
location, and to drop an item from the session entirely, before confirming.

#### Scenario: Correcting a count

- **WHEN** the user reduces an item's count from 6 to 4
- **THEN** the created entry has an amount of 4

#### Scenario: Dropping a mis-scan

- **WHEN** the user removes an item during review
- **THEN** no entry is created for it
- **AND** the remaining items are unaffected

### Requirement: Confirmation creates all entries in one action

Confirming SHALL create pantry entries for every remaining item in a single
action. The merge rule SHALL be applied against the existing pantry at this
point, not during scanning.

#### Scenario: One confirmation

- **WHEN** the user confirms a session of fourteen items
- **THEN** fourteen items' worth of entries are created without further prompting

#### Scenario: Merging against the existing pantry

- **WHEN** a session item matches an existing pantry entry under the merge rule
- **THEN** the amounts are combined into that entry rather than creating a
  second one

#### Scenario: Not merging against the existing pantry

- **WHEN** a session item matches an existing entry but the merge rule does not
  apply
- **THEN** a separate entry is created

#### Scenario: Session is cleared on success

- **WHEN** confirmation completes
- **THEN** the persisted session is cleared
- **AND** reopening the app does not offer to resume it
