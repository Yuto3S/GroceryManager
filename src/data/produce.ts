// The produce this app knows about, so loose fruit and veg is a tap rather than
// a spelling decision.
//
// PROVENANCE
//   Source    USDA FSIS FoodKeeper, `foodkeeper.json` (data version 128,
//             modified 2018-09-06).
//   Via       Internet Archive snapshot 20231110203616 of
//             https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json
//             The live URL returns Akamai "Access Denied" to anything that is
//             not a browser, so the archived copy is the only retrievable one.
//   Licence   CC0 1.0 Universal (public domain). No attribution required; this
//             note exists so the table can be dated and refreshed, not for
//             legal reasons.
//   Retrieved 2026-08-23.
//
// This is a CURATED SUBSET, not the file. FoodKeeper's produce categories
// (Fresh Fruits, Fresh Vegetables) hold 101 rows that are shelf-life records
// rather than a shopping vocabulary: several fruits share one row
// ("Peaches, nectarines, plums, pears, sapote"), and some things are split by
// storage state in ways no one shops by. Rows were split, renamed to what a
// German supermarket calls them, and trimmed to what a home cook buys.
//
// `source` is the FoodKeeper product ID each item came from, so any row here
// can be checked against the original. Several items legitimately share one
// source: that is a multi-fruit row being split, not a mistake.
//
// SHELF LIFE is the refrigerator figure where FoodKeeper gives one, and the
// pantry figure otherwise — the longest of the range, in days. Nothing in this
// change reads it. It is populated now because the source is open in front of
// whoever curates, and a second pass over 102 rows later is worse. The change
// that uses it is `add-expiry-estimates`.
//
// `group` is our own editorial split, not FoodKeeper's category. It mostly
// follows theirs, but rhubarb is filed with fruit because that is how it is
// cooked, and the aromatics are pulled out of Vegetables into their own group.

/** The sections the picker shows, in the order it shows them. */
export const PRODUCE_GROUPS = [
  "Vegetables",
  "Fruit",
  "Herbs & aromatics",
] as const;

export type ProduceGroup = (typeof PRODUCE_GROUPS)[number];

export interface ProduceItem {
  /**
   * Stable identity, assigned here and never derived from `name`.
   *
   * Renaming an item must not orphan the pantry entries already added under
   * it, so this is the one field that may never change once shipped.
   */
  key: string;
  /** What the picker shows. Safe to reword. */
  name: string;
  group: ProduceGroup;
  /**
   * Days this keeps for. Carried for `add-expiry-estimates`; read by nothing
   * today. Non-null by construction — every row has one, and a test enforces
   * it so the field cannot rot half-filled.
   */
  shelfLifeDays: number;
  /**
   * The icon the picker shows.
   *
   * An emoji, not an image: it costs no bytes, needs no licence, no asset
   * pipeline and no network, which is the only kind of icon that leaves the
   * offline guarantee intact. Where nothing specific exists — parsnips, okra,
   * most exotic fruit — the item falls back to its group's emoji rather than
   * borrowing a lookalike, because a wrong icon reads as a wrong item.
   *
   * Deliberately kept to emoji from Unicode 14 and earlier; a device that has
   * not caught up to a newer set renders a blank box, which looks broken.
   */
  emoji: string;
  /** FoodKeeper product ID this row was derived from. Provenance, not logic. */
  source: number;
}

export const PRODUCE: readonly ProduceItem[] = [
  // Vegetables
  {
    key: "artichokes",
    name: "Artichokes",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 270,
  },
  {
    key: "asparagus",
    name: "Asparagus",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 4,
    source: 271,
  },
  {
    key: "aubergine",
    name: "Aubergine",
    emoji: "🍆",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 284,
  },
  {
    key: "baby-carrots",
    name: "Baby carrots",
    emoji: "🥕",
    group: "Vegetables",
    shelfLifeDays: 28,
    source: 491,
  },
  {
    key: "bean-sprouts",
    name: "Bean sprouts",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 10,
    source: 549,
  },
  {
    key: "beetroot",
    name: "Beetroot",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 274,
  },
  {
    key: "bok-choy",
    name: "Bok choy",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 3,
    source: 275,
  },
  {
    key: "broad-beans",
    name: "Broad beans",
    emoji: "🫘",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 273,
  },
  {
    key: "broccoli",
    name: "Broccoli",
    emoji: "🥦",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 276,
  },
  {
    key: "brussels-sprouts",
    name: "Brussels sprouts",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 277,
  },
  {
    key: "butternut-squash",
    name: "Butternut squash",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 90,
    source: 303,
  },
  {
    key: "cabbage",
    name: "Cabbage",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 278,
  },
  {
    key: "carrots",
    name: "Carrots",
    emoji: "🥕",
    group: "Vegetables",
    shelfLifeDays: 21,
    source: 279,
  },
  {
    key: "cauliflower",
    name: "Cauliflower",
    emoji: "🥦",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 280,
  },
  {
    key: "celeriac",
    name: "Celeriac",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 661,
  },
  {
    key: "celery",
    name: "Celery",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 281,
  },
  {
    key: "cherry-tomatoes",
    name: "Cherry tomatoes",
    emoji: "🍅",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 600,
  },
  {
    key: "chillies",
    name: "Chillies",
    emoji: "🌶️",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 548,
  },
  {
    key: "corn",
    name: "Corn on the cob",
    emoji: "🌽",
    group: "Vegetables",
    shelfLifeDays: 2,
    source: 282,
  },
  {
    key: "courgette",
    name: "Courgette",
    emoji: "🥒",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 547,
  },
  {
    key: "cucumber",
    name: "Cucumber",
    emoji: "🥒",
    group: "Vegetables",
    shelfLifeDays: 6,
    source: 283,
  },
  {
    key: "edamame",
    name: "Edamame",
    emoji: "🫘",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 640,
  },
  {
    key: "garlic",
    name: "Garlic",
    emoji: "🧄",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 285,
  },
  {
    key: "green-beans",
    name: "Green beans",
    emoji: "🫘",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 273,
  },
  {
    key: "jalapenos",
    name: "Jalapeños",
    emoji: "🌶️",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 548,
  },
  {
    key: "kale",
    name: "Kale",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 423,
  },
  {
    key: "kohlrabi",
    name: "Kohlrabi",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 494,
  },
  {
    key: "leeks",
    name: "Leeks",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 289,
  },
  {
    key: "lettuce",
    name: "Lettuce",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 290,
  },
  {
    key: "mangetout",
    name: "Mangetout",
    emoji: "🫘",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 273,
  },
  {
    key: "mushrooms",
    name: "Mushrooms",
    emoji: "🍄",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 292,
  },
  {
    key: "okra",
    name: "Okra",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 3,
    source: 293,
  },
  {
    key: "onions",
    name: "Onions",
    emoji: "🧅",
    group: "Vegetables",
    shelfLifeDays: 60,
    source: 294,
  },
  {
    key: "parsnips",
    name: "Parsnips",
    emoji: "🥕",
    group: "Vegetables",
    shelfLifeDays: 21,
    source: 279,
  },
  {
    key: "peas",
    name: "Peas",
    emoji: "🫘",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 273,
  },
  {
    key: "peppers",
    name: "Peppers",
    emoji: "🫑",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 296,
  },
  {
    key: "potatoes",
    name: "Potatoes",
    emoji: "🥔",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 297,
  },
  {
    key: "pumpkin",
    name: "Pumpkin",
    emoji: "🎃",
    group: "Vegetables",
    shelfLifeDays: 150,
    source: 298,
  },
  {
    key: "radicchio",
    name: "Radicchio",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 21,
    source: 674,
  },
  {
    key: "radishes",
    name: "Radishes",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 299,
  },
  {
    key: "red-onions",
    name: "Red onions",
    emoji: "🧅",
    group: "Vegetables",
    shelfLifeDays: 60,
    source: 294,
  },
  {
    key: "rocket",
    name: "Rocket",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 678,
  },
  {
    key: "romaine",
    name: "Romaine lettuce",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 290,
  },
  {
    key: "spaghetti-squash",
    name: "Spaghetti squash",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 596,
  },
  {
    key: "spinach",
    name: "Spinach",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 291,
  },
  {
    key: "spring-onions",
    name: "Spring onions",
    emoji: "🧅",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 295,
  },
  {
    key: "sugar-snap-peas",
    name: "Sugar snap peas",
    emoji: "🫘",
    group: "Vegetables",
    shelfLifeDays: 5,
    source: 273,
  },
  {
    key: "swede",
    name: "Swede",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 21,
    source: 301,
  },
  {
    key: "sweet-potatoes",
    name: "Sweet potatoes",
    emoji: "🍠",
    group: "Vegetables",
    shelfLifeDays: 21,
    source: 422,
  },
  {
    key: "chard",
    name: "Swiss chard",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 550,
  },
  {
    key: "tomatoes",
    name: "Tomatoes",
    emoji: "🍅",
    group: "Vegetables",
    shelfLifeDays: 7,
    source: 306,
  },
  {
    key: "turnips",
    name: "Turnips",
    emoji: "🥬",
    group: "Vegetables",
    shelfLifeDays: 14,
    source: 307,
  },

  // Fruit
  {
    key: "apples",
    name: "Apples",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 42,
    source: 248,
  },
  {
    key: "apricots",
    name: "Apricots",
    emoji: "🍑",
    group: "Fruit",
    shelfLifeDays: 5,
    source: 249,
  },
  {
    key: "avocados",
    name: "Avocados",
    emoji: "🥑",
    group: "Fruit",
    shelfLifeDays: 4,
    source: 250,
  },
  {
    key: "bananas",
    name: "Bananas",
    emoji: "🍌",
    group: "Fruit",
    shelfLifeDays: 3,
    source: 251,
  },
  {
    key: "blackberries",
    name: "Blackberries",
    emoji: "🫐",
    group: "Fruit",
    shelfLifeDays: 6,
    source: 253,
  },
  {
    key: "blueberries",
    name: "Blueberries",
    emoji: "🫐",
    group: "Fruit",
    shelfLifeDays: 14,
    source: 254,
  },
  {
    key: "cantaloupe",
    name: "Cantaloupe",
    emoji: "🍈",
    group: "Fruit",
    shelfLifeDays: 15,
    source: 496,
  },
  {
    key: "cherries",
    name: "Cherries",
    emoji: "🍒",
    group: "Fruit",
    shelfLifeDays: 3,
    source: 483,
  },
  {
    key: "clementines",
    name: "Clementines",
    emoji: "🍊",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 256,
  },
  {
    key: "coconut",
    name: "Coconut",
    emoji: "🥥",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 258,
  },
  {
    key: "cranberries",
    name: "Cranberries",
    emoji: "🫐",
    group: "Fruit",
    shelfLifeDays: 60,
    source: 259,
  },
  {
    key: "dates",
    name: "Dates",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 360,
    source: 260,
  },
  {
    key: "dragon-fruit",
    name: "Dragon fruit",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 480,
  },
  {
    key: "gooseberries",
    name: "Gooseberries",
    emoji: "🫐",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 252,
  },
  {
    key: "grapefruit",
    name: "Grapefruit",
    emoji: "🍊",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 256,
  },
  {
    key: "grapes",
    name: "Grapes",
    emoji: "🍇",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 261,
  },
  {
    key: "guava",
    name: "Guava",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 4,
    source: 262,
  },
  {
    key: "honeydew",
    name: "Honeydew melon",
    emoji: "🍈",
    group: "Fruit",
    shelfLifeDays: 4,
    source: 497,
  },
  {
    key: "kiwi",
    name: "Kiwi fruit",
    emoji: "🥝",
    group: "Fruit",
    shelfLifeDays: 6,
    source: 263,
  },
  {
    key: "kumquats",
    name: "Kumquats",
    emoji: "🍊",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 414,
  },
  {
    key: "lemons",
    name: "Lemons",
    emoji: "🍋",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 256,
  },
  {
    key: "limes",
    name: "Limes",
    emoji: "🍋",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 256,
  },
  {
    key: "lychee",
    name: "Lychee",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 252,
  },
  {
    key: "mango",
    name: "Mango",
    emoji: "🥭",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 265,
  },
  {
    key: "melon",
    name: "Melon",
    emoji: "🍈",
    group: "Fruit",
    shelfLifeDays: 14,
    source: 264,
  },
  {
    key: "nectarines",
    name: "Nectarines",
    emoji: "🍑",
    group: "Fruit",
    shelfLifeDays: 5,
    source: 266,
  },
  {
    key: "oranges",
    name: "Oranges",
    emoji: "🍊",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 256,
  },
  {
    key: "papaya",
    name: "Papaya",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 265,
  },
  {
    key: "passion-fruit",
    name: "Passion fruit",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 265,
  },
  {
    key: "peaches",
    name: "Peaches",
    emoji: "🍑",
    group: "Fruit",
    shelfLifeDays: 5,
    source: 266,
  },
  {
    key: "pears",
    name: "Pears",
    emoji: "🍐",
    group: "Fruit",
    shelfLifeDays: 5,
    source: 266,
  },
  {
    key: "pineapple",
    name: "Pineapple",
    emoji: "🍍",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 267,
  },
  {
    key: "plantains",
    name: "Plantains",
    emoji: "🍌",
    group: "Fruit",
    shelfLifeDays: 5,
    source: 268,
  },
  {
    key: "plums",
    name: "Plums",
    emoji: "🍑",
    group: "Fruit",
    shelfLifeDays: 5,
    source: 266,
  },
  {
    key: "pomegranate",
    name: "Pomegranate",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 90,
    source: 269,
  },
  {
    key: "raspberries",
    name: "Raspberries",
    emoji: "🫐",
    group: "Fruit",
    shelfLifeDays: 3,
    source: 482,
  },
  {
    key: "rhubarb",
    name: "Rhubarb",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 7,
    source: 300,
  },
  {
    key: "star-fruit",
    name: "Star fruit",
    emoji: "🍎",
    group: "Fruit",
    shelfLifeDays: 14,
    source: 478,
  },
  {
    key: "strawberries",
    name: "Strawberries",
    emoji: "🍓",
    group: "Fruit",
    shelfLifeDays: 3,
    source: 481,
  },
  {
    key: "tangerines",
    name: "Tangerines",
    emoji: "🍊",
    group: "Fruit",
    shelfLifeDays: 21,
    source: 256,
  },
  {
    key: "watermelon",
    name: "Watermelon",
    emoji: "🍉",
    group: "Fruit",
    shelfLifeDays: 4,
    source: 495,
  },

  // Herbs & aromatics
  {
    key: "basil",
    name: "Basil",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 10,
    source: 509,
  },
  {
    key: "chives",
    name: "Chives",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 512,
  },
  {
    key: "coriander",
    name: "Coriander",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 506,
  },
  {
    key: "ginger",
    name: "Ginger",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 286,
  },
  {
    key: "lemongrass",
    name: "Lemongrass",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 9,
    source: 505,
  },
  {
    key: "mint",
    name: "Mint",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 507,
  },
  {
    key: "oregano",
    name: "Oregano",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 510,
  },
  {
    key: "parsley",
    name: "Parsley",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 3,
    source: 611,
  },
  {
    key: "rosemary",
    name: "Rosemary",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 511,
  },
  {
    key: "thyme",
    name: "Thyme",
    emoji: "🌿",
    group: "Herbs & aromatics",
    shelfLifeDays: 21,
    source: 513,
  },
];
