## Purpose

Governs the pictures the produce picker draws: that every item has one, that
they read as a single coherent set rather than a collection of found artwork,
and that the artwork behind them is licence-clean and available offline.

## ADDED Requirements

### Requirement: Every produce item has artwork

Every item in the produce list SHALL have its own icon. The system SHALL NOT
render a produce item with a generic stand-in, a stand-in borrowed from another
item, or a picture drawn from a different medium.

Adding a produce item without artwork SHALL fail an automated check, so
completeness is enforced rather than remembered.

#### Scenario: Every item in the list draws its own icon

- **WHEN** the produce picker is opened and any item is shown
- **THEN** that item displays artwork belonging to that item

#### Scenario: An item added without artwork is rejected

- **WHEN** a produce item is added to the list with no artwork for it
- **THEN** an automated check fails and names the item

#### Scenario: Artwork with no matching item is rejected

- **WHEN** artwork exists whose key matches no item in the produce list
- **THEN** an automated check fails and names it, so removed items do not leave
  their pictures behind in the bundle

### Requirement: Icons read as one set

The icons SHALL form a single visual set: a shared colour palette, a consistent
treatment of outline and fill, one canvas size, and optical padding chosen so
that every icon carries comparable visual weight at the size a tile draws it.

Icons SHALL have a transparent background, so a tile's own background shows
through and no icon appears to sit on a card of its own.

#### Scenario: Two items side by side look like the same set

- **WHEN** any two produce items are shown next to each other in the grid
- **THEN** they share the palette, outline treatment and apparent weight, with
  no visible difference in style between them

#### Scenario: A tall item and a wide item balance

- **WHEN** a tall narrow item and a short wide item are shown in the same row
- **THEN** neither appears significantly larger or heavier than the other

#### Scenario: Icons sit on the tile, not on their own panel

- **WHEN** an icon is drawn on a tile
- **THEN** the tile's background is visible around and behind the artwork

### Requirement: Icons are legible at the size they are used

An icon SHALL be recognisable at the size the picker draws it, without the
user relying on the item's name to tell it apart from a similar item.

Source artwork SHALL be at least the pixel size the highest-density supported
screen requires, so it is never scaled up.

#### Scenario: Similar items are distinguishable at tile size

- **WHEN** two items of similar shape and colour are shown at tile size
- **THEN** their icons are visibly different from each other

#### Scenario: Artwork is not upscaled

- **WHEN** an icon is drawn on the highest-density screen the app supports
- **THEN** the source artwork is at least the physical pixel size required

### Requirement: Artwork is licence-clean and its provenance recorded

Every asset SHALL be licensed for redistribution in this application, and its
source SHALL be recorded with enough detail to audit and to refresh it: where it
came from, under what licence, and when it was obtained.

Provenance SHALL be recorded per asset rather than per set, because a set
assembled from several origins cannot be audited from one note.

#### Scenario: Any icon can be traced to its source

- **WHEN** a maintainer asks where a given icon came from
- **THEN** the repository states that asset's origin, licence and date obtained

#### Scenario: An asset with unclear licensing is not shipped

- **WHEN** artwork cannot be confirmed as licensed for redistribution
- **THEN** it is not included, and the item is resolved another way

### Requirement: Icons are available offline

Icons SHALL be part of the application bundle. The system SHALL NOT fetch icon
artwork at runtime, and the build SHALL NOT fetch it at install time or in
continuous integration.

#### Scenario: The picker draws icons with no network

- **WHEN** the produce picker is opened on a device with no network access
- **THEN** every icon is drawn, with no placeholder and no loading state

#### Scenario: A build makes no request for artwork

- **WHEN** the application is installed and built from a clean checkout
- **THEN** no icon artwork is downloaded as part of that process

### Requirement: The icon set has a stated size cost

The artwork's contribution to the application bundle SHALL be recorded, so that
growth is a decision rather than a surprise.

#### Scenario: The size is recorded

- **WHEN** the icon set is complete
- **THEN** the repository states how much of the bundle the artwork accounts for
