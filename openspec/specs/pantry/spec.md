# pantry Specification

## Purpose
Records what the user currently has at home — which products, how much of each,
and where they are kept — and tracks that amount downward as things get used.

## Requirements

### Requirement: Pantry entries record an amount in a unit

Every pantry entry SHALL carry an amount, a unit, and a consume step. The unit
SHALL be one of `piece`, `g`, or `ml`. The step SHALL be the quantity removed by
a single consume action.

Rendering follows the unit: `piece` displays as a count (`×4`), `g` and `ml`
display as a measure (`800 g`).

#### Scenario: Countable product

- **WHEN** an entry has unit `piece`, amount 4, step 1
- **THEN** it displays as `×4`
- **AND** one consume action leaves amount 3

#### Scenario: Bulk product

- **WHEN** an entry has unit `g`, amount 1000, step 100
- **THEN** it displays as `1000 g`
- **AND** one consume action leaves 900 g

#### Scenario: Consuming cannot go negative

- **WHEN** an entry has amount 50 and step 100
- **AND** the user consumes once
- **THEN** the amount becomes 0, never a negative number

### Requirement: A unit is fixed for an entry's lifetime

Once an entry exists, its unit SHALL NOT change. Converting between a count and a
measure requires knowledge the system does not have (the mass of one item).

#### Scenario: No unit switch after creation

- **WHEN** the user views an existing entry created with unit `piece`
- **THEN** no control offers to change it to `g` or `ml`
- **AND** changing it requires removing the entry and adding it again

### Requirement: Entries at zero are hidden, not deleted

An entry whose amount reaches zero SHALL be marked out of stock and hidden from
the pantry view. It SHALL NOT be deleted, and SHALL NOT be added to any shopping
list automatically.

These hidden entries are the user's purchase history and are read by later
features.

#### Scenario: Last unit consumed

- **WHEN** an entry at amount 1, step 1, is consumed
- **THEN** the entry no longer appears in the pantry view
- **AND** the entry is still persisted, marked out of stock

#### Scenario: Restocking a hidden entry

- **WHEN** the user adds a product that has a hidden out-of-stock entry
- **THEN** the merge rule decides whether that entry is revived or a new one is
  created, on the same terms as any other duplicate

### Requirement: Every entry has a location

Every pantry entry SHALL reference a location. Locations SHALL be a
user-extensible list, not a fixed set. The system SHALL seed `Fridge`, `Freezer`
and `Cupboard` on first run.

#### Scenario: Default location on add

- **WHEN** a product is added and its catalogue record names a default location
- **THEN** that location is pre-selected

#### Scenario: User adds a location

- **WHEN** the user creates a location named `Cellar`
- **THEN** it is available for selection on every subsequent add
- **AND** existing entries are unaffected

### Requirement: Removing a location never orphans the entries in it

The system SHALL allow locations to be added, renamed and removed. Removing a
location that still holds entries SHALL require the user to nominate a
destination location; those entries SHALL be reassigned to it before the removed
location is tombstoned. Removal SHALL NOT delete entries and SHALL NOT leave an
entry pointing at a removed location.

The system SHALL refuse to remove the last remaining location, since there would
be nowhere for entries to go.

Renaming a location SHALL NOT change which entries belong to it — entries
reference a location by identity, not by name.

#### Scenario: Removing an empty location

- **WHEN** the user removes a location holding no entries
- **THEN** it is removed without further prompting
- **AND** it no longer appears as a choice when adding an entry

#### Scenario: Removing a location that still holds entries

- **WHEN** the user removes a location holding entries
- **THEN** they are asked where those entries should go
- **AND** on confirming, every entry in it — including out-of-stock ones —
  references the nominated location
- **AND** no entry is deleted

#### Scenario: Cancelling the removal

- **WHEN** the user is asked for a destination and cancels
- **THEN** the location and its entries are unchanged

#### Scenario: The last location cannot be removed

- **WHEN** only one location exists
- **THEN** removing it is refused

#### Scenario: Renaming keeps the entries

- **WHEN** the user renames `Cupboard` to `Pantry shelf`
- **THEN** the entries that were in it are still in it

### Requirement: The pantry groups by location and sorts alphabetically

The pantry view SHALL group entries by location by default, and SHALL sort
entries alphabetically by name within each group. The user SHALL be able to
switch grouping to category, derived from product data rather than stored per
entry.

#### Scenario: Default view

- **WHEN** the user opens the pantry
- **THEN** entries appear under location headings
- **AND** within each heading they are ordered alphabetically

#### Scenario: Grouping by category

- **WHEN** the user switches grouping to category
- **THEN** entries are grouped by their derived product category
- **AND** entries with no derivable category appear under a single `Other` group

#### Scenario: Empty locations

- **WHEN** a location contains no visible entries
- **THEN** that group is not rendered

### Requirement: Duplicate products merge only when their dates cannot conflict

When a product is added that already has a visible pantry entry, the system SHALL
merge into the existing entry if any of the following hold, and SHALL otherwise
create a separate entry:

1. Both were added on the same local calendar day, or within the same add session
2. The product's shelf life exceeds a defined long-life threshold
3. Neither entry carries an expiry date

Merging adds the incoming amount to the existing entry. Separate entries of the
same product SHALL be individually visible in the pantry view.

#### Scenario: Same session, short shelf life

- **WHEN** the user adds the same yoghurt six times in one session
- **THEN** one entry exists with amount 6

#### Scenario: Different days, short shelf life

- **WHEN** the user added milk three days ago and adds the same milk today
- **THEN** two separate entries exist

#### Scenario: Different days, long shelf life

- **WHEN** the user added tinned tomatoes in March and adds the same tin today
- **AND** the product's shelf life exceeds the long-life threshold
- **THEN** one entry exists with the amounts summed

#### Scenario: No dates on either side

- **WHEN** the user adds a product for which no shelf life can be determined
- **AND** an existing entry for it also has no expiry date
- **THEN** the entries merge

#### Scenario: Duplicates are distinguishable

- **WHEN** two entries for the same product are visible
- **THEN** each row shows the information that distinguishes them, so they do
  not read as a duplicated row

### Requirement: Entries carry identity and audit fields that survive multi-device use

Every pantry entry, catalogue record and location SHALL have a client-generated
UUID, a `createdAt` and `updatedAt` timestamp stored as UTC epoch milliseconds,
and SHALL be removed by setting a `deletedAt` tombstone rather than by deleting
the record.

Calendar dates that describe a day rather than an instant — expiry being the
case that arrives later — SHALL be stored as `YYYY-MM-DD`, not as a timestamp.

#### Scenario: Identity does not collide across devices

- **WHEN** two devices create entries while offline
- **THEN** their identifiers do not collide

#### Scenario: Removal is recoverable

- **WHEN** the user removes an entry
- **THEN** the record persists with `deletedAt` set
- **AND** it does not appear anywhere in the UI

#### Scenario: Edits are ordered

- **WHEN** any field of an entry changes
- **THEN** `updatedAt` is set to the current UTC epoch milliseconds
