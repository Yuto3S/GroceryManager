// Adding loose fruit and veg — the things with no barcode to scan.
//
// A picker rather than a text box, because typing is where the same tomato
// becomes three catalogue records: `Tomatoes`, `tomato`, `Vine tomatoes`. A
// picked item carries its own stable key, so the second punnet is the same
// product as the first however anyone would have spelled it.
//
// A GRID, not a list. With a hundred items a list is a column of near-identical
// rows you have to read one at a time, and the picture on each is decoration.
// In a grid the picture is the affordance: three times as many items fit on
// screen, and you find the carrot by its shape without reading anything. That
// is the difference between this being faster than typing and not.
//
// Two more things keep it from being a wall: a chip row that narrows to one
// group, and sections that collapse so a group you never buy from can be shut.
// What is in the list and in what order is still `src/lib/produce.ts`.

import { useMemo, useState } from "react";
import {
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AddSheet from "../components/AddSheet";
import ProduceIcon from "../components/ProduceIcon";
import type { ProduceGroup, ProduceItem } from "../data/produce";
import { PRODUCE_GROUPS } from "../data/produce";
import { gridRows, groupProduce, searchProduce } from "../lib/produce";
import {
  type AddProductInput,
  productInputForProduce,
} from "../state/pantryReducer";
import { colors } from "../theme";

/**
 * Tiles per row.
 *
 * Three rather than four: the longest names here — "Brussels sprouts",
 * "Spaghetti squash" — need two lines at four columns on a narrow phone, and a
 * grid where some tiles are taller than others stops reading as a grid.
 */
const COLUMNS = 3;

/** Shorter than the group names, because a chip row has no room. */
const CHIP_LABELS: Record<ProduceGroup, string> = {
  Vegetables: "Veg",
  Fruit: "Fruit",
  "Herbs & aromatics": "Herbs",
};

/** The chip and section testIDs derive from this, so they stay predictable. */
const slug = (group: ProduceGroup) => group.split(" ")[0]?.toLowerCase() ?? "";

interface ProduceAddScreenProps {
  onDone: () => void;
  onCancel: () => void;
  /**
   * Offered when the search matches nothing, carrying what was typed.
   *
   * The list is curated, so a miss is expected rather than exceptional — and a
   * dead end here would be worse than the text box this screen replaces.
   */
  onType: (query: string) => void;
}

export default function ProduceAddScreen({
  onDone,
  onCancel,
  onType,
}: ProduceAddScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProduceGroup | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<ProduceGroup>>(
    new Set(),
  );
  const [product, setProduct] = useState<AddProductInput | null>(null);

  const searching = query.trim().length > 0;

  const sections = useMemo(
    () =>
      groupProduce(searchProduce(query))
        .filter((section) => filter === null || section.group === filter)
        .map((section) => ({
          title: section.group,
          count: section.items.length,
          // A collapsed section keeps its header and its count — that is what
          // makes it obviously re-openable rather than gone. Searching wins
          // over the collapse: hiding results the user just asked for would
          // read as the search being broken.
          data:
            collapsed.has(section.group) && !searching
              ? []
              : gridRows(section.items, COLUMNS),
        })),
    [query, filter, collapsed, searching],
  );

  if (product) {
    // Cancelling the sheet goes back to the grid, not out of the picker.
    // Passing the route's `onCancel` straight through would throw away the
    // search and the section you had open to undo one tap.
    return (
      <AddSheet
        product={product}
        onDone={onDone}
        onCancel={() => setProduct(null)}
      />
    );
  }

  const toggle = (group: ProduceGroup) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(group)) next.add(group);
      return next;
    });

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search fruit and veg"
          placeholderTextColor={colors.subtle}
          accessibilityLabel="Search fruit and veg"
          testID="produce-search"
          autoCorrect={false}
          returnKeyType="search"
        />

        <View style={styles.chips}>
          <Chip
            label="All"
            testID="produce-chip-all"
            active={filter === null}
            onPress={() => setFilter(null)}
          />
          {PRODUCE_GROUPS.map((group) => (
            <Chip
              key={group}
              label={CHIP_LABELS[group]}
              testID={`produce-chip-${slug(group)}`}
              active={filter === group}
              onPress={() => setFilter(filter === group ? null : group)}
            />
          ))}
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={styles.centre}>
          <Text style={styles.title}>Not on the list</Text>
          <Text style={styles.body}>
            The list covers what a shop usually stocks loose. Anything else goes
            in by name.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.button}
            testID="produce-type-instead"
            onPress={() => onType(query)}
          >
            <Text style={styles.buttonText}>Add “{query}” by name</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          // A row has no identity of its own, so it borrows its first item's.
          keyExtractor={(row) => row[0]?.key ?? "empty"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const shut = collapsed.has(section.title) && !searching;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: !shut }}
                accessibilityLabel={`${section.title}, ${section.count} items`}
                accessibilityHint={
                  shut ? "Expands this group" : "Collapses this group"
                }
                style={styles.header}
                testID={`produce-section-${slug(section.title)}`}
                onPress={() => toggle(section.title)}
              >
                <Text style={styles.chevron}>{shut ? "▶" : "▼"}</Text>
                <Text style={styles.heading}>{section.title}</Text>
                <Text style={styles.count}>{section.count}</Text>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              {row.map((cell) => (
                <TouchableOpacity
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityLabel={cell.name}
                  style={styles.tile}
                  testID={`produce-${cell.key}`}
                  onPress={() => setProduct(productInputForProduce(cell))}
                >
                  <ProduceIcon item={cell} />
                  <Text style={styles.tileName} numberOfLines={2}>
                    {cell.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.link}
        testID="produce-cancel"
        onPress={onCancel}
      >
        <Text style={styles.linkText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipOn]}
      testID={testID}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Gap between tiles, and the page's side margin. One number, so they agree. */
const GUTTER = 10;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // The search and chips are pinned above the scroll area rather than riding
  // inside it: filtering a long grid you have scrolled into is exactly when you
  // need them, and that is exactly when they would be off screen.
  top: {
    paddingHorizontal: GUTTER + 2,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.subtle },
  chipTextOn: { color: colors.primaryText },
  list: { paddingBottom: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: GUTTER + 6,
    paddingTop: 18,
    paddingBottom: 8,
  },
  chevron: { fontSize: 11, color: colors.subtle },
  heading: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: colors.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  count: { fontSize: 12, fontWeight: "700", color: colors.subtle },
  row: {
    flexDirection: "row",
    gap: GUTTER,
    paddingHorizontal: GUTTER + 2,
    paddingBottom: GUTTER,
  },
  tile: {
    // A fixed share of the row, not an equal split of it. `flex: 1` would make
    // a final row of one item stretch that tile across the screen; a width
    // keeps every tile the same size whatever the row holds, which is what
    // lets the short last row need no padding at all.
    //
    // Three tiles at 31.5% plus two gaps lands just inside 100%.
    width: "31.5%",
    // Square-ish, so the grid reads as a grid whether a name wraps or not.
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  body: { color: colors.subtle, textAlign: "center" },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.primaryText, fontWeight: "800" },
  link: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
