// The one pass that turns a session into pantry entries.
//
// Nothing exists until the user confirms here. Items that could not be resolved
// come first, because they are the only ones that need anything from the user —
// everything else is already correct by construction, carrying the catalogue
// defaults it would have got from the add sheet.

import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addDefaultsFor, measureLabel } from "../lib/catalogue";
import { usePantry } from "../state/PantryStore";
import { useScanSession } from "../state/ScanSessionStore";
import {
  displayName,
  needsAttention,
  reviewOrder,
  type ScanSessionItem,
  sessionItemToAdd,
} from "../state/scanSession";
import { colors } from "../theme";

interface ScanReviewScreenProps {
  onDone: () => void;
  onBack: () => void;
}

export default function ScanReviewScreen({
  onDone,
  onBack,
}: ScanReviewScreenProps) {
  const { catalogue, locations, addProduct } = usePantry();
  const { session, patchItem, dropItem, endSession } = useScanSession();
  const [names, setNames] = useState<Record<string, string>>({});

  const items = useMemo(() => (session ? reviewOrder(session) : []), [session]);
  const unresolved = items.filter(needsAttention).length;

  if (!session || items.length === 0) {
    return (
      <View style={styles.centre}>
        <Text style={styles.title}>Nothing to review</Text>
        <Text style={styles.body}>Scan something first.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.link}
          onPress={onBack}
        >
          <Text style={styles.linkText}>Back to scanning</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function confirm() {
    if (!session) return;
    // One action: every item becomes an add, and the merge rule runs against
    // the pantry as it is now — not as it was when the scanning started.
    for (const item of reviewOrder(session)) {
      addProduct(sessionItemToAdd(item, catalogue));
    }
    endSession();
    onDone();
  }

  function renderItem(item: ScanSessionItem) {
    const attention = needsAttention(item);
    const add = sessionItemToAdd(item, catalogue);
    const amountLabel =
      add.unit === "piece" ? `×${add.amount}` : `${add.amount} ${add.unit}`;
    const location = locations.find((l) => l.id === item.locationId);

    // A tin of peas says "265 g", so the parsed default is a mass — but what
    // you own is a tin, and what you use is a tin. Only the user knows which
    // they meant, so both are offered rather than guessed at.
    const defaults = addDefaultsFor(
      catalogue[add.product.key] ?? null,
      add.product.quantityText,
    );
    const byCount = add.unit === "piece";

    return (
      <View style={[styles.row, attention && styles.rowAttention]}>
        <View style={styles.rowHead}>
          {/*
            The same picture the pantry list shows, from the same field. A row
            of names alone gives the eye nothing to check against the tin in
            your hand — which is the whole job of this screen. An unresolved
            item has no picture, and the empty frame is itself a signal.
          */}
          {item.product?.imageUrl ? (
            <Image
              source={{ uri: item.product.imageUrl }}
              style={styles.thumb}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <View style={styles.rowText}>
            <Text style={styles.rowName} numberOfLines={1}>
              {displayName(item)}
            </Text>
            {item.product?.brand ? (
              <Text style={styles.rowBrand} numberOfLines={1}>
                {item.product.brand}
              </Text>
            ) : null}
          </View>
          <Text style={styles.rowAmount}>{amountLabel}</Text>
        </View>

        {attention ? (
          <View style={styles.nameRow}>
            <TextInput
              style={styles.input}
              value={names[item.barcode] ?? ""}
              onChangeText={(text) =>
                setNames((prev) => ({ ...prev, [item.barcode]: text }))
              }
              placeholder="What is it?"
              placeholderTextColor={colors.subtle}
              accessibilityLabel={`Name for ${item.barcode}`}
            />
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.small,
                !(names[item.barcode] ?? "").trim() && styles.smallOff,
              ]}
              disabled={!(names[item.barcode] ?? "").trim()}
              onPress={() =>
                patchItem(item.barcode, { name: names[item.barcode] ?? "" })
              }
            >
              <Text style={styles.smallText}>Name</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.forms}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: byCount }}
            accessibilityLabel={`Count ${displayName(item)}`}
            style={[styles.place, byCount && styles.placeOn]}
            // The step goes back to null so it is re-derived for the form just
            // chosen; keeping a 100 g step on a count would be nonsense.
            onPress={() =>
              patchItem(item.barcode, { unit: "piece", step: null })
            }
          >
            <Text style={[styles.placeText, byCount && styles.placeTextOn]}>
              Count
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: !byCount }}
            accessibilityLabel={`Weigh ${displayName(item)}`}
            style={[styles.place, !byCount && styles.placeOn]}
            onPress={() =>
              patchItem(item.barcode, {
                unit: defaults.measureUnit,
                step: null,
              })
            }
          >
            <Text style={[styles.placeText, !byCount && styles.placeTextOn]}>
              {measureLabel(defaults.measureUnit)}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Fewer ${displayName(item)}`}
            style={styles.control}
            onPress={() =>
              patchItem(item.barcode, { count: Math.max(1, item.count - 1) })
            }
          >
            <Text style={styles.controlGlyph}>−</Text>
          </TouchableOpacity>
          <Text style={styles.count}>×{item.count}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`More ${displayName(item)}`}
            style={styles.control}
            onPress={() => patchItem(item.barcode, { count: item.count + 1 })}
          >
            <Text style={styles.controlGlyph}>+</Text>
          </TouchableOpacity>

          <View style={styles.spacer} />

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remove ${displayName(item)}`}
            style={styles.drop}
            onPress={() => dropItem(item.barcode)}
          >
            <Text style={styles.dropText}>Remove</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.places}>
          {locations.map((candidate) => {
            const selected = candidate.id === item.locationId;
            return (
              <TouchableOpacity
                key={candidate.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.place, selected && styles.placeOn]}
                onPress={() =>
                  patchItem(item.barcode, { locationId: candidate.id })
                }
              >
                <Text
                  style={[styles.placeText, selected && styles.placeTextOn]}
                >
                  {candidate.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {location ? null : (
          <Text style={styles.warn}>That place no longer exists.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {items.length} {items.length === 1 ? "product" : "products"}
        </Text>
        <Text style={styles.body}>
          {unresolved === 0
            ? "Everything was recognised."
            : `${unresolved} need${unresolved === 1 ? "s" : ""} a name — they're first.`}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.barcode}
        renderItem={({ item }) => renderItem(item)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.link}
          onPress={onBack}
        >
          <Text style={styles.linkText}>Keep scanning</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.confirm}
          onPress={confirm}
        >
          <Text style={styles.confirmText}>Add {items.length} to pantry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  body: { color: colors.subtle },
  list: { paddingBottom: 12 },
  row: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  rowAttention: { borderColor: colors.danger },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: colors.bg },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowBrand: { fontSize: 12, color: colors.subtle },
  rowAmount: { fontSize: 14, fontWeight: "700", color: colors.subtle },
  nameRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  small: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  smallOff: { opacity: 0.4 },
  smallText: { color: colors.primaryText, fontWeight: "800" },
  controls: { flexDirection: "row", alignItems: "center" },
  control: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  controlGlyph: { fontSize: 20, fontWeight: "800", color: colors.primary },
  count: {
    minWidth: 44,
    textAlign: "center",
    fontWeight: "700",
    color: colors.text,
  },
  spacer: { flex: 1 },
  drop: { paddingVertical: 8, paddingHorizontal: 10 },
  dropText: { color: colors.danger, fontWeight: "700" },
  forms: { flexDirection: "row", gap: 6 },
  places: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  place: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  placeText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  placeTextOn: { color: colors.primaryText },
  warn: { color: colors.danger, fontSize: 12 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  confirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  confirmText: { color: colors.primaryText, fontWeight: "800", fontSize: 16 },
  link: { paddingVertical: 12, paddingHorizontal: 8 },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
