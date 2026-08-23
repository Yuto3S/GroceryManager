## ADDED Requirements

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
