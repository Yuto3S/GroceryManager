## Purpose

Lets the user add loose fruit, vegetables and herbs — the things that carry no
barcode — by choosing from a fixed, offline list rather than typing a name, so
that the same product gets the same identity every time it is added.

## ADDED Requirements

### Requirement: A fixed produce list is available offline

The system SHALL carry a list of common fruit, vegetables and herbs that is
available with no network access and no lookup. Every item SHALL have a stable
key, a display name, and a group.

The list SHALL be a fixed part of the application. The system SHALL NOT fetch,
update or refresh it at runtime, at install time, or as part of a build.

#### Scenario: Browsing with no network

- **WHEN** the user opens the produce picker with the device offline
- **THEN** the full list is shown, with no error and no loading state

#### Scenario: The list is the same on every device

- **WHEN** the same version of the application is run on two devices
- **THEN** both show the same produce items with the same keys

### Requirement: Produce items are grouped for browsing

The picker SHALL present items grouped by kind — vegetables, fruit, and herbs
and aromatics — rather than as one undifferentiated list. Groups SHALL appear in
a fixed order, and items within a group SHALL be ordered predictably so that the
list does not reshuffle between visits.

#### Scenario: Groups are shown in a stable order

- **WHEN** the user opens the picker twice without changing anything
- **THEN** the groups and the items inside them appear in the same order both times

#### Scenario: An empty group is not shown

- **WHEN** a search leaves a group with no matching items
- **THEN** that group's heading is not rendered over empty space

### Requirement: Produce can be found by searching

The picker SHALL let the user narrow the list by typing. A search SHALL match
regardless of capitalisation and accents, using the same comparison form the
catalogue uses for typed names, so that a user who does not type an accent still
finds the item.

#### Scenario: Search ignores case and accents

- **WHEN** the user types `jalapeno` and the list contains `Jalapeño`
- **THEN** that item is among the results

#### Scenario: An unusable search shows everything

- **WHEN** the search box contains only punctuation or whitespace
- **THEN** the full grouped list is shown rather than no results

#### Scenario: A search matching nothing says so

- **WHEN** the user searches for something not in the list
- **THEN** the picker states that nothing matched and offers to add it by name instead

### Requirement: A produce item has a canonical identity

Each produce item SHALL have an identity derived from its own stable key, not
from the text the user searched for or the way its name is spelled. Adding the
same produce item on two occasions SHALL reach the same catalogue record.

A produce identity SHALL be distinguishable from both a barcode identity and a
typed-name identity, so that a produce item and a hand-typed product of the same
name cannot collide.

#### Scenario: The same item added twice is one product

- **WHEN** the user picks `Carrots` from the picker on two separate occasions
- **THEN** both additions resolve to the same catalogue record, and its use count reflects both

#### Scenario: A typed name does not collide with a produce item

- **WHEN** the user picks `Carrots` from the picker and separately types `carrots` by hand
- **THEN** the two are distinct catalogue records

#### Scenario: Identity survives a rewording

- **WHEN** a produce item's display name changes in a later version of the application
- **THEN** entries already added under that item still resolve to the same catalogue record

### Requirement: Produce carries a category

A product added from the picker SHALL carry a category derived from its group,
so that the pantry's group-by-category view places it under that category rather
than in the leftovers bucket used for products with no category.

#### Scenario: Produce is categorised in the pantry

- **WHEN** the user adds a produce item and views the pantry grouped by category
- **THEN** the entry appears under its produce category, not under `Other`

### Requirement: The vendored list records its provenance

The produce list SHALL record, in the source itself, where the data came from
and the date it was retrieved.

#### Scenario: The source can be identified and dated

- **WHEN** a maintainer opens the produce data file
- **THEN** it states its upstream source, that source's licence, and the date the data was retrieved

### Requirement: Shelf-life data is carried but not used

The produce list MAY carry a shelf life for each item in preparation for a later
change. Within this capability, nothing SHALL read it: no expiry date is
suggested, prefilled or implied, and the presence or absence of a shelf life
SHALL NOT change any observable behavior.

#### Scenario: Adding produce suggests no expiry

- **WHEN** the user adds a produce item that carries a shelf life in the data
- **THEN** the add sheet's expiry field is empty, exactly as it is for a typed name

### Requirement: Free-text entry remains available

Adding a product by typing its name SHALL remain available for everything the
produce list does not cover. The picker SHALL NOT replace it, and reaching the
picker SHALL NOT be a prerequisite for typing a name.

#### Scenario: A product that is not produce can still be added

- **WHEN** the user wants to add something absent from the produce list
- **THEN** typing a name is still offered and works as it did before

#### Scenario: The picker offers a way out to free text

- **WHEN** the user searches the picker for an item that is not in the list
- **THEN** the picker offers to add that name by hand without losing what was typed
