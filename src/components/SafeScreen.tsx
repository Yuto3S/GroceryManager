// The chrome every pushed route needs and none of them had.
//
// Only the tab layout ever handled the safe area, so every screen pushed on top
// of it — manual add, the camera, locations, backup — drew its first row under
// the status bar and its last row into the home indicator. On a notched phone
// that put "What is it?" behind the clock.
//
// This is a route-level concern, not a screen-level one: the screens are
// presentational and should not each have to remember. Route files wrap their
// screen in this, so a new route gets it by existing rather than by someone
// noticing.

import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

const DEFAULT_EDGES: Edge[] = ["top", "bottom", "left", "right"];

interface SafeScreenProps {
  children: ReactNode;
  /**
   * Which edges to inset. A full-bleed camera screen passes none and insets its
   * own overlays instead, because the picture should reach the corners even
   * though the buttons over it must not.
   */
  edges?: Edge[];
}

export default function SafeScreen({
  children,
  edges = DEFAULT_EDGES,
}: SafeScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
