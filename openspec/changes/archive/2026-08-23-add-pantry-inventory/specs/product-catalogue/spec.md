## Purpose

Remembers every product the user has ever added, so it can be re-added without
scanning, and accumulates the per-product preferences the user has already
expressed rather than asking again.

## ADDED Requirements

### Requirement: The catalogue records every product ever added and never evicts

The system SHALL record every product added to the pantry in a durable catalogue.
Catalogue records SHALL NOT be evicted by size or age.

This is distinct from the offline lookup cache, which exists to make re-scans
work without a network and remains capped.

#### Scenario: Product is remembered after the pantry entry is gone

- **WHEN** a product is added, fully consumed, and its entry hidden
- **THEN** the product is still in the catalogue

#### Scenario: Catalogue outlives the cache

- **WHEN** the offline lookup cache evicts a product because it exceeded its cap
- **THEN** the catalogue record for that product is unaffected

### Requirement: Products added without a barcode get a stable identity

Products added by typing a name SHALL be identified by a key normalized from that
name, so that adding the same name again resolves to the existing catalogue
record rather than creating a near-duplicate.

#### Scenario: Same name typed twice

- **WHEN** the user types `Bread` and later types `bread `
- **THEN** both resolve to one catalogue record

#### Scenario: Barcode identity takes precedence

- **WHEN** a product has a barcode
- **THEN** the barcode identifies it, and the name is not used for identity

### Requirement: The catalogue stores per-product defaults that improve with use

A catalogue record SHALL store the defaults used when the product is next added:
its default unit, its consume step for each of the count and measure forms, and
its default location. When the user overrides one of these on an add, the system
SHALL persist the override to the catalogue record.

#### Scenario: Step is remembered

- **WHEN** the user sets a 125 g consume step for a pasta product
- **AND** later adds the same product again
- **THEN** the add sheet is pre-filled with a 125 g step

#### Scenario: Location is remembered

- **WHEN** the user has previously put a product in `Freezer`
- **AND** adds the same product again
- **THEN** `Freezer` is pre-selected

#### Scenario: First-time defaults come from product data

- **WHEN** a product is added for the first time
- **THEN** its defaults are derived from the product's own data
- **AND** where that data is absent or unparseable, the defaults are one piece
  with a step of one

### Requirement: Users can add a product from the catalogue without scanning

The system SHALL let the user add a pantry entry by selecting a product from the
catalogue. Catalogue entries SHALL be ordered to put the user's most-used
products first, and SHALL be searchable by name.

#### Scenario: Re-adding a known product

- **WHEN** the user picks a product from the catalogue
- **THEN** an add sheet opens pre-filled with that product's stored defaults
- **AND** no network request is made

#### Scenario: Ordering reflects use

- **WHEN** the user has added a product many times
- **THEN** it appears before products added once

#### Scenario: Empty catalogue

- **WHEN** the catalogue has no records
- **THEN** the picker states that plainly and offers scanning or typing a name
