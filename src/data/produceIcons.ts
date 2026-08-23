// Bundled artwork for the produce picker, one entry per item that has any.
//
// GENERATED-ish: the entries mirror `assets/produce/*.png`, and a test fails if
// a key here has no matching item in `src/data/produce.ts`. Edit it by hand when
// you add artwork — but keep the `require` calls literal.
//
// The literal `require` is the whole reason this file exists. Metro resolves
// asset paths at build time by reading the string in the call, so
// `require(`../../assets/produce/${key}.png`)` does not work: it fails at
// runtime, not at compile time, and only for the items you did not open. An
// explicit map is the honest version of that constraint.
//
// PROVENANCE
//   Source    openfarmcc/open-crop-icons — https://github.com/openfarmcc/open-crop-icons
//   Licence   CC0 1.0 (public domain). No attribution required; credited here
//             so the set can be found again and refreshed.
//   Retrieved 2026-08-23, rasterised from SVG to 128px PNG.
//
// 128px, not 34: a tile renders the icon at 34pt, which is 102 physical pixels
// on a 3x screen. A source smaller than that would be upscaled and soft.
//
// COVERAGE IS PARTIAL — 77 of 103. The set is a seed catalogue, so it is
// strongest exactly where emoji is weakest (parsnip, celeriac, kohlrabi, okra,
// salsify) and has no citrus and almost no common fruit. Anything missing falls
// back to its emoji in `ProduceIcon`. The gap is tracked in the
// `add-produce-picker` change.

/** Artwork by produce key. Absent means "no drawing yet", not "no icon". */
export const PRODUCE_ICONS: Readonly<Record<string, number>> = {
  apples: require("../../assets/produce/apples.png"),
  apricots: require("../../assets/produce/apricots.png"),
  artichokes: require("../../assets/produce/artichokes.png"),
  asparagus: require("../../assets/produce/asparagus.png"),
  aubergine: require("../../assets/produce/aubergine.png"),
  "baby-carrots": require("../../assets/produce/baby-carrots.png"),
  basil: require("../../assets/produce/basil.png"),
  beetroot: require("../../assets/produce/beetroot.png"),
  blackberries: require("../../assets/produce/blackberries.png"),
  blueberries: require("../../assets/produce/blueberries.png"),
  "bok-choy": require("../../assets/produce/bok-choy.png"),
  "broad-beans": require("../../assets/produce/broad-beans.png"),
  broccoli: require("../../assets/produce/broccoli.png"),
  "brussels-sprouts": require("../../assets/produce/brussels-sprouts.png"),
  "butternut-squash": require("../../assets/produce/butternut-squash.png"),
  cabbage: require("../../assets/produce/cabbage.png"),
  cantaloupe: require("../../assets/produce/cantaloupe.png"),
  carrots: require("../../assets/produce/carrots.png"),
  cauliflower: require("../../assets/produce/cauliflower.png"),
  celeriac: require("../../assets/produce/celeriac.png"),
  celery: require("../../assets/produce/celery.png"),
  chard: require("../../assets/produce/chard.png"),
  cherries: require("../../assets/produce/cherries.png"),
  "cherry-tomatoes": require("../../assets/produce/cherry-tomatoes.png"),
  chillies: require("../../assets/produce/chillies.png"),
  chives: require("../../assets/produce/chives.png"),
  coriander: require("../../assets/produce/coriander.png"),
  corn: require("../../assets/produce/corn.png"),
  courgette: require("../../assets/produce/courgette.png"),
  cucumber: require("../../assets/produce/cucumber.png"),
  edamame: require("../../assets/produce/edamame.png"),
  garlic: require("../../assets/produce/garlic.png"),
  ginger: require("../../assets/produce/ginger.png"),
  "green-beans": require("../../assets/produce/green-beans.png"),
  honeydew: require("../../assets/produce/honeydew.png"),
  jalapenos: require("../../assets/produce/jalapenos.png"),
  kale: require("../../assets/produce/kale.png"),
  kohlrabi: require("../../assets/produce/kohlrabi.png"),
  leeks: require("../../assets/produce/leeks.png"),
  lemongrass: require("../../assets/produce/lemongrass.png"),
  lettuce: require("../../assets/produce/lettuce.png"),
  mangetout: require("../../assets/produce/mangetout.png"),
  melon: require("../../assets/produce/melon.png"),
  mint: require("../../assets/produce/mint.png"),
  mushrooms: require("../../assets/produce/mushrooms.png"),
  nectarines: require("../../assets/produce/nectarines.png"),
  okra: require("../../assets/produce/okra.png"),
  onions: require("../../assets/produce/onions.png"),
  oregano: require("../../assets/produce/oregano.png"),
  parsley: require("../../assets/produce/parsley.png"),
  parsnips: require("../../assets/produce/parsnips.png"),
  peaches: require("../../assets/produce/peaches.png"),
  pears: require("../../assets/produce/pears.png"),
  peas: require("../../assets/produce/peas.png"),
  peppers: require("../../assets/produce/peppers.png"),
  plantains: require("../../assets/produce/plantains.png"),
  plums: require("../../assets/produce/plums.png"),
  potatoes: require("../../assets/produce/potatoes.png"),
  pumpkin: require("../../assets/produce/pumpkin.png"),
  radicchio: require("../../assets/produce/radicchio.png"),
  radishes: require("../../assets/produce/radishes.png"),
  raspberries: require("../../assets/produce/raspberries.png"),
  "red-onions": require("../../assets/produce/red-onions.png"),
  rocket: require("../../assets/produce/rocket.png"),
  romaine: require("../../assets/produce/romaine.png"),
  rosemary: require("../../assets/produce/rosemary.png"),
  "spaghetti-squash": require("../../assets/produce/spaghetti-squash.png"),
  spinach: require("../../assets/produce/spinach.png"),
  "spring-onions": require("../../assets/produce/spring-onions.png"),
  strawberries: require("../../assets/produce/strawberries.png"),
  "sugar-snap-peas": require("../../assets/produce/sugar-snap-peas.png"),
  swede: require("../../assets/produce/swede.png"),
  "sweet-potatoes": require("../../assets/produce/sweet-potatoes.png"),
  thyme: require("../../assets/produce/thyme.png"),
  tomatoes: require("../../assets/produce/tomatoes.png"),
  turnips: require("../../assets/produce/turnips.png"),
  watermelon: require("../../assets/produce/watermelon.png"),
};
