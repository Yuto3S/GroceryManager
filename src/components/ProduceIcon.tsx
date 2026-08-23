// The picture on a produce tile.
//
// THIS IS THE ONE PLACE THAT DECIDES WHAT A PRODUCE ICON IS. The picker lays
// out tiles; what goes inside them is settled here and nowhere else, so the
// artwork can change without any screen being touched.
//
// Two sources, in order:
//
//   1. Bundled artwork from `open-crop-icons` (CC0) — see `produceIcons.ts`.
//      Covers 77 of 103, and is strongest exactly where emoji is weakest:
//      parsnips, celeriac, kohlrabi, okra, radicchio, swede.
//   2. The item's emoji, for anything with no drawing yet.
//
// The emoji fallback is a stopgap and reads as one. It has no glyph for most
// herbs, so every herb falls back to the same generic leaf and ten different
// plants render identically — which is precisely the failure that motivated
// bundling artwork. Filling the gap is tracked in the `add-produce-picker`
// change; nothing outside this file changes when it is filled.

import { Image, StyleSheet, Text } from "react-native";
import type { ProduceItem } from "../data/produce";
import { PRODUCE_ICONS } from "../data/produceIcons";

interface ProduceIconProps {
  item: ProduceItem;
  /** Rendered size in points. The icon is square. */
  size?: number;
}

export default function ProduceIcon({ item, size = 34 }: ProduceIconProps) {
  const source = PRODUCE_ICONS[item.key];

  if (source !== undefined) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        testID={`produce-art-${item.key}`}
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
      testID={`produce-emoji-${item.key}`}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {item.emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  // `includeFontPadding: false` keeps a tall glyph from shifting the tile's
  // text baseline, which would make one cell in a grid row sit lower than the
  // rest.
  emoji: { textAlign: "center", includeFontPadding: false },
});
