// The pantry: what is in the fridge, freezer and cupboards right now.
//
// Grouped by location, because that matches the physical act of standing at an
// open fridge and checking the app against what is actually there — the
// reconciliation that keeps the inventory honest. Category grouping is the
// alternative view, derived from product data so it costs the user nothing.

import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  type ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { type GroupMode, groupPantry, type PantryRow } from "../lib/grouping";
import { usePantry } from "../state/PantryStore";
import { colors } from "../theme";

/** One line in the flattened list — headers and rows share a single FlatList. */
type Line =
  | { type: "header"; key: string; title: string; count: number }
  | { type: "row"; key: string; row: PantryRow };

export default function PantryScreen() {
  const { loaded, entries, catalogue, locations, consumeEntry, restockEntry } =
    usePantry();
  const [mode, setMode] = useState<GroupMode>("location");
  const router = useRouter();

  const groups = useMemo(
    () => groupPantry(entries, catalogue, locations, mode),
    [entries, catalogue, locations, mode],
  );

  const lines = useMemo<Line[]>(
    () =>
      groups.flatMap((group) => [
        {
          type: "header" as const,
          key: `h:${group.key}`,
          title: group.title,
          count: group.rows.length,
        },
        ...group.rows.map((row) => ({
          type: "row" as const,
          key: row.entry.id,
          row,
        })),
      ]),
    [groups],
  );

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.rows.length, 0),
    [groups],
  );

  function renderLine({ item }: ListRenderItemInfo<Line>) {
    if (item.type === "header") {
      return (
        <View style={styles.header}>
          <Text style={styles.headerText}>{item.title}</Text>
          <Text style={styles.headerCount}>{item.count}</Text>
        </View>
      );
    }

    const { entry, product, name } = item.row;
    const measure =
      entry.unit === "piece"
        ? `×${entry.amount}`
        : `${entry.amount} ${entry.unit}`;

    return (
      <View style={styles.row}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
          style={styles.rowMain}
          onPress={() => router.push(`/entry/${entry.id}`)}
        >
          {product?.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <View style={styles.rowText}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.rowMeta}>
              {product?.brand ? (
                <Text style={styles.rowBrand} numberOfLines={1}>
                  {product.brand}
                </Text>
              ) : null}
              {/* The expiry date lands here. The slot is reserved now so that
                  change is a fill-in rather than a re-layout, and it is also
                  what will tell two rows of the same product apart. */}
              <Text style={styles.rowDate}>{entry.expiresAt ?? ""}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.rowControls}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Use some ${name}`}
            style={styles.control}
            onPress={() => consumeEntry(entry.id)}
          >
            <Text style={styles.controlGlyph}>−</Text>
          </TouchableOpacity>
          <Text style={styles.amount}>{measure}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Add more ${name}`}
            style={styles.control}
            onPress={() => restockEntry(entry.id, entry.step)}
          >
            <Text style={styles.controlGlyph}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading your pantry…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.segmented}>
          {(["location", "category"] as const).map((option) => {
            const selected = mode === option;
            return (
              <TouchableOpacity
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.segment, selected && styles.segmentOn]}
                onPress={() => setMode(option)}
              >
                <Text
                  style={[styles.segmentText, selected && styles.segmentTextOn]}
                >
                  {option === "location" ? "By place" : "By category"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Link href="/locations" asChild>
          <TouchableOpacity accessibilityRole="button" style={styles.manage}>
            <Text style={styles.manageText}>Places</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing in the pantry yet</Text>
          <Text style={styles.emptyText}>
            Scan a barcode or type a name on the Add tab.
          </Text>
        </View>
      ) : (
        <FlatList
          data={lines}
          keyExtractor={(line) => line.key}
          renderItem={renderLine}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  segmented: { flexDirection: "row", gap: 6, flex: 1 },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.text },
  segmentTextOn: { color: colors.primaryText },
  manage: { paddingVertical: 8, paddingHorizontal: 12 },
  manageText: { color: colors.primary, fontWeight: "700" },
  list: { paddingBottom: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.subtle,
    textTransform: "uppercase",
  },
  headerCount: { fontSize: 12, fontWeight: "700", color: colors.subtle },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.bg },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowBrand: { flex: 1, fontSize: 12, color: colors.subtle },
  rowDate: {
    fontSize: 12,
    color: colors.subtle,
    minWidth: 74,
    textAlign: "right",
  },
  rowControls: { flexDirection: "row", alignItems: "center", paddingRight: 6 },
  control: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  controlGlyph: { fontSize: 20, color: colors.primary, fontWeight: "800" },
  amount: {
    minWidth: 60,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: { color: colors.subtle, textAlign: "center" },
});
