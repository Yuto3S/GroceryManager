## MODIFIED Requirements

### Requirement: Every add path ends at the same sheet

Scanning a barcode, picking from the catalogue, picking from the produce list
and typing a name SHALL all lead to one add sheet that resolves amount, unit,
consume step and location. The sheet SHALL be pre-filled from the product's
catalogue record where one exists, and from the product's own data otherwise.

#### Scenario: Adding by scan

- **WHEN** the user scans a barcode that resolves to a product
- **THEN** the add sheet opens pre-filled with that product's name and defaults

#### Scenario: Adding by name

- **WHEN** the user types a product name
- **THEN** the same add sheet opens, defaulting to one piece with a step of one

#### Scenario: Adding from the produce list

- **WHEN** the user picks an item from the produce list
- **THEN** the same add sheet opens, pre-filled with that item's name and category

#### Scenario: Produce remembers what it was added with

- **WHEN** the user adds a produce item they have added before
- **THEN** the sheet opens with the unit, step and location that item was last added with

#### Scenario: Nothing is created until confirmed

- **WHEN** the user dismisses the add sheet without confirming
- **THEN** no pantry entry and no catalogue record are created

## ADDED Requirements

### Requirement: A produce selection supplies no quantity of its own

A produce item is a kind of thing, not a package, so it SHALL NOT supply
quantity text to the add sheet. The sheet SHALL fall back to its default of one
piece with a step of one, exactly as it does for a typed name, unless the user's
own catalogue record for that item says otherwise.

#### Scenario: A first-time produce add defaults to one piece

- **WHEN** the user picks a produce item they have never added before
- **THEN** the sheet opens on the count form at one piece, with a step of one

#### Scenario: Produce carries no brand or image

- **WHEN** a produce item reaches the add sheet
- **THEN** no brand, product image or nutritional grade is shown for it
