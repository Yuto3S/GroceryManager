## Purpose

Lets the user enter many products in one continuous pass — camera live, no
per-item confirmation — so that stocking the pantry for the first time takes
minutes rather than an evening.

## ADDED Requirements

### Requirement: Scanning never waits on the network

A scan SHALL be accepted, acknowledged and queued without waiting for a product
lookup. Lookups SHALL run in the background and update the queued item in place
when they resolve.

The session SHALL function with no network connection at all.

#### Scenario: Lookup is slow

- **WHEN** a product lookup takes several seconds
- **THEN** the user can scan further items during that time
- **AND** each is accepted immediately

#### Scenario: No network

- **WHEN** the device has no connectivity
- **THEN** scanning continues to accept items, recorded by barcode
- **AND** those items are marked as unresolved for the review step

#### Scenario: Lookup resolves later

- **WHEN** a queued item's lookup completes
- **THEN** the item gains the product's name and defaults
- **AND** the user's scanning is not interrupted

### Requirement: A rescan of the same product increases its count

Within a session, scanning a barcode that has already been scanned SHALL
increment that queued item's count rather than adding a second queued item.

Repeat reads of the same barcode within a short debounce window SHALL be ignored,
so that a camera holding steady on one barcode does not inflate the count.

#### Scenario: Deliberate rescan

- **WHEN** the user scans the same yoghurt six times, pausing between each
- **THEN** the queue holds one item with a count of 6

#### Scenario: Camera burst

- **WHEN** the camera reads the same barcode repeatedly within the debounce
  window
- **THEN** the count increases by one, not once per read

#### Scenario: Count is visible as it changes

- **WHEN** a rescan increments an item
- **THEN** the acknowledgement shows the new count
- **AND** an immediate undo for that increment is offered

### Requirement: Each scan is acknowledged distinguishably without being read

The system SHALL acknowledge every scan immediately. Three outcomes — a new item,
an incremented duplicate, and a barcode that could not be resolved — SHALL be
distinguishable by haptic feedback alone.

Acknowledgement SHALL NOT block or delay the next scan.

#### Scenario: New item

- **WHEN** a new barcode is scanned
- **THEN** feedback for a new item is given and the item appears in the queue

#### Scenario: Unresolvable barcode

- **WHEN** a barcode cannot be resolved to a product
- **THEN** feedback distinct from the new-item case is given
- **AND** the item is still queued

#### Scenario: Feedback is unavailable

- **WHEN** the platform provides no haptic support
- **THEN** scanning still works and is acknowledged visually
- **AND** no error is raised

#### Scenario: Decoded value holds no product number

- **WHEN** the scanner decodes a value containing no product number
- **THEN** no lookup is attempted
- **AND** the value is not added to the queue

### Requirement: Scanning is offered only where it works

The system SHALL offer a scanning entry point only on platforms where barcode
scanning is actually available, and SHALL NOT render a control that cannot work.
Where scanning is unavailable, the system SHALL say so and SHALL still offer the
add paths that do not need a camera.

Availability SHALL NOT depend on downloading a barcode-decoding engine at
runtime, so that the offline guarantee above holds wherever scanning is offered.

#### Scenario: Platform without barcode scanning

- **WHEN** the user opens the add screen on a platform with no barcode scanning
- **THEN** no scanning entry point is shown
- **AND** the reason is stated, and typing a name or picking from the catalogue
  remain available

#### Scenario: Platform with barcode scanning

- **WHEN** the user opens the add screen on a platform that can scan
- **THEN** the scanning entry points are shown and work offline

### Requirement: A session applies one location to everything scanned in it

A session SHALL have a single location, chosen when it starts and changeable
during it. Items queued in a session SHALL take that location.

#### Scenario: Location set once

- **WHEN** the user starts a session with location `Fridge` and scans twelve
  items
- **THEN** all twelve are destined for `Fridge` without further input

#### Scenario: Location changed mid-session

- **WHEN** the user changes the session location partway through
- **THEN** items scanned after the change take the new location
- **AND** items already scanned keep the location they were scanned under

### Requirement: A session survives interruption

The session SHALL be persisted as items are added, not only when it ends. On
reopening the app with an unfinished session, the user SHALL be offered the
choice of resuming or discarding it.

#### Scenario: App is killed mid-session

- **WHEN** the app terminates after forty scans
- **AND** the user reopens it
- **THEN** the forty items are still present and the session can be resumed

#### Scenario: Stale session

- **WHEN** an unfinished session is several days old
- **THEN** the user is asked whether to resume or discard it rather than having
  it silently revived

#### Scenario: Discarding

- **WHEN** the user discards an unfinished session
- **THEN** no pantry entries are created from it
- **AND** the persisted session is cleared

### Requirement: The screen stays awake during a session

The system SHALL prevent the device from sleeping while a scan session is active,
and SHALL release that hold when the session ends or is left.

#### Scenario: Long session

- **WHEN** the user scans for several minutes
- **THEN** the screen does not sleep

#### Scenario: Session left

- **WHEN** the user leaves the scan screen
- **THEN** normal sleep behaviour resumes
