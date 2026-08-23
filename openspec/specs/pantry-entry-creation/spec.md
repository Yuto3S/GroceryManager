# pantry-entry-creation Specification

## Purpose
Covers every way a product gets into the pantry — scanned, picked from the
catalogue, or typed — and the single sheet that settles how much of it there is
before an entry exists.

## Requirements

### Requirement: Every add path ends at the same sheet

Scanning a barcode, picking from the catalogue and typing a name SHALL all lead
to one add sheet that resolves amount, unit, consume step and location. The sheet
SHALL be pre-filled from the product's catalogue record where one exists, and
from the product's own data otherwise.

#### Scenario: Adding by scan

- **WHEN** the user scans a barcode that resolves to a product
- **THEN** the add sheet opens pre-filled with that product's name and defaults

#### Scenario: Adding by name

- **WHEN** the user types a product name
- **THEN** the same add sheet opens, defaulting to one piece with a step of one

#### Scenario: Nothing is created until confirmed

- **WHEN** the user dismisses the add sheet without confirming
- **THEN** no pantry entry and no catalogue record are created

### Requirement: The sheet offers a choice between counting and measuring

The add sheet SHALL offer exactly two ways to express quantity: by count, or by
measure. The measure unit SHALL be `g` or `ml` as appropriate to the product, and
SHALL NOT be chosen by the user. The default selection SHALL come from the
product's catalogue record or its own data.

#### Scenario: Count is the sensible default

- **WHEN** the product is a countable item
- **THEN** count is pre-selected and the amount is expressed as a number of pieces

#### Scenario: Measure for a bulk product

- **WHEN** the product's own data gives a mass
- **THEN** measure is pre-selected, using `g`
- **AND** the user is not asked to choose between `g` and `ml`

#### Scenario: Switching before confirming

- **WHEN** the user switches from count to measure before confirming
- **THEN** the amount and step reset to that form's defaults for the product

### Requirement: Product quantity text is parsed defensively

The system SHALL derive a default amount and unit from the product's own quantity
text where possible. That text is community-edited and untrusted: parsing SHALL
NOT throw on any input, and SHALL fall back to one piece with a step of one
whenever the text cannot be understood.

#### Scenario: Recognisable mass

- **WHEN** the quantity text reads `500 g`
- **THEN** the measure default is 500 g

#### Scenario: Recognisable volume

- **WHEN** the quantity text reads `1 L`
- **THEN** the measure default is 1000 ml

#### Scenario: Multipack

- **WHEN** the quantity text reads `6 x 125 g`
- **THEN** the count default is 6 pieces

#### Scenario: Unparseable text

- **WHEN** the quantity text is empty, malformed, or contains no quantity
- **THEN** the default is one piece with a step of one
- **AND** no error is surfaced to the user

### Requirement: Products can be added when lookup fails

The system SHALL allow an entry to be created from a scanned barcode even when
the product cannot be looked up, whether because it is not in the database or
because the network is unavailable. Such an entry SHALL be identifiable as
needing a name.

#### Scenario: Offline scan

- **WHEN** the user scans a barcode with no network available
- **THEN** an entry can still be created, recorded against that barcode
- **AND** it is marked as needing a name

#### Scenario: Unknown barcode

- **WHEN** a scanned barcode is not present in the product database
- **THEN** the same path is offered

#### Scenario: Scanned data holds no barcode

- **WHEN** the scanner decodes a value containing no product number
- **THEN** no lookup request is made
- **AND** the user is told the code was not a product barcode

### Requirement: Removing an entry is distinct from consuming it

The system SHALL offer removing an entry as an action separate from consuming it.
Removing SHALL take effect regardless of the remaining amount.

#### Scenario: Removing a part-used entry

- **WHEN** the user removes an entry with amount 400 g
- **THEN** the entry is gone from the pantry
- **AND** it is recorded as removed rather than as fully consumed

### Requirement: Entries can be created in bulk from a scan session

The system SHALL support creating many pantry entries from a single confirmed
scan session, applying each product's catalogue defaults without prompting per
item.

The single-item add sheet remains the path for adding one product at a time; this
adds a second path rather than replacing it.

#### Scenario: Bulk creation applies catalogue defaults

- **WHEN** a session is confirmed containing a product already in the catalogue
- **THEN** the created entry uses that product's stored unit, step and location
  defaults
- **AND** the user is not shown the add sheet for it

#### Scenario: Bulk creation populates the catalogue

- **WHEN** a session is confirmed containing a product not previously seen
- **THEN** a catalogue record is created for it, as it would be from the add sheet

#### Scenario: Merge rule applies across a batch

- **WHEN** a confirmed session contains a product that also exists in the pantry
- **THEN** the merge rule decides between combining and separating, on the same
  terms as a single-item add
