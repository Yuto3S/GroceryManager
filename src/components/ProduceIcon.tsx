// The picture on a produce tile.
//
// THIS IS THE ONE PLACE THAT DECIDES WHAT A PRODUCE ICON IS. The picker lays
// out tiles; what goes inside them is settled here and nowhere else, so the
// artwork can change without the layout being touched.
//
// It renders the item's emoji today. That is an interim answer, not the
// intended one: emoji has no glyph for parsnips, celeriac, kohlrabi or okra,
// and falling back to a lookalike (a carrot standing in for a parsnip) reads as
// the wrong item rather than as a missing picture.
//
// The replacement being weighed is bundled artwork — `openfarmcc/open-crop-icons`
// (CC0) covers 77 of the 103 with real drawings and is strongest exactly where
// emoji is weakest, but has no citrus and no common fruit at all. Whatever
// lands, it arrives as a swap of this component's body: give the item an
// `iconSource` and render an `<Image>`, keeping the same props and the same
// sizing contract, and every screen follows without edits.

import { Image, StyleSheet, Text } from "react-native";
import type { ProduceItem } from "../data/produce";

interface ProduceIconProps {
  item: ProduceItem;
  /** Rendered size in points. The icon is square. */
  size?: number;
}

export default function ProduceIcon({ item, size = 34 }: ProduceIconProps) {
  // `iconSource` does not exist on ProduceItem yet — when it does, this branch
  // is what starts using it, and the emoji below becomes the fallback for
  // anything still awaiting artwork.
  const source = (item as ProduceItem & { iconSource?: number }).iconSource;

  if (source !== undefined) {
    return (
      <Image
        source={source}
        style={[styles.image, { width: size, height: size }]}
        resizeMode="contain"
        // Decorative: the tile already carries the item's name as text, and a
        // screen reader announcing "carrot image, Carrots" is noise.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }

  return (
    <Text
      style={[styles.emoji, { fontSize: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {item.emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  image: { alignSelf: "center" },
  // A line height matching the font size keeps tall glyphs from shifting the
  // tile's text baseline, which would make a grid row look misaligned.
  emoji: { textAlign: "center", includeFontPadding: false },
});
