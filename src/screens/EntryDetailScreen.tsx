// One pantry entry: how much is left, where it lives, and getting rid of it.

import { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePantry } from "../state/PantryStore";
import { colors } from "../theme";

interface EntryDetailScreenProps {
  id: string;
  onDone: () => void;
}

export default function EntryDetailScreen({
  id,
  onDone,
}: EntryDetailScreenProps) {
  const {
    entries,
    catalogue,
    locations,
    consumeEntry,
    restockEntry,
    moveEntry,
    renameEntryProduct,
    removeEntry,
  } = usePantry();

  const entry = entries[id];
  const product = entry ? (catalogue[entry.productKey] ?? null) : null;
  const [name, setName] = useState(
    product?.needsName ? "" : (product?.name ?? ""),
  );

  if (!entry || entry.deletedAt !== null) {
    return (
      <View style={styles.centre}>
        <Text style={styles.title}>This entry is gone</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.link}
          onPress={onDone}
        >
          <Text style={styles.linkText}>Back to the pantry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const measure =
    entry.unit === "piece"
      ? `×${entry.amount}`
      : `${entry.amount} ${entry.unit}`;

  function confirmRemove() {
    // Removing is not the same as finishing something: the entry is recorded as
    // got-rid-of rather than consumed, so it is worth an explicit confirmation.
    const doRemove = () => {
      removeEntry(id);
      onDone();
    };

    if (Platform.OS === "web") {
      doRemove();
      return;
    }
    Alert.alert("Remove this entry?", "It leaves the pantry either way.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: doRemove },
    ]);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.product}>
        {product?.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}
        <View style={styles.productText}>
          <Text style={styles.title}>
            {product && !product.needsName ? product.name : "Unnamed product"}
          </Text>
          {product?.brand ? (
            <Text style={styles.body}>{product.brand}</Text>
          ) : null}
          {product?.category ? (
            <Text style={styles.body}>{product.category}</Text>
          ) : null}
        </View>
      </View>

      {product?.needsName ? (
        <View style={styles.block}>
          <Text style={styles.label}>Give it a name</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Oat milk"
              placeholderTextColor={colors.subtle}
              accessibilityLabel="Product name"
            />
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.small, !name.trim() && styles.smallOff]}
              disabled={!name.trim()}
              onPress={() => renameEntryProduct(id, name)}
            >
              <Text style={styles.smallText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>How much is left</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Use some"
          style={styles.stepperButton}
          onPress={() => consumeEntry(id)}
        >
          <Text style={styles.stepperGlyph}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{measure}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add more"
          style={styles.stepperButton}
          onPress={() => restockEntry(id, entry.step)}
        >
          <Text style={styles.stepperGlyph}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Each tap uses {entry.step}
        {entry.unit === "piece" ? "" : ` ${entry.unit}`}. At zero it leaves the
        pantry but stays in your history.
      </Text>

      {/* The unit is fixed for an entry's lifetime. Converting ×4 into grams
          needs the mass of one item, which nothing here knows — so the sheet
          asks once, at creation, and never offers a conversion afterwards. */}
      <Text style={styles.hint}>
        Measured by {entry.unit === "piece" ? "count" : entry.unit}. To change
        that, remove this entry and add it again.
      </Text>

      <Text style={styles.label}>Where it lives</Text>
      <View style={styles.chips}>
        {locations.map((location) => {
          const selected = location.id === entry.locationId;
          return (
            <TouchableOpacity
              key={location.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => moveEntry(id, location.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {location.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.remove}
        onPress={confirmRemove}
      >
        <Text style={styles.removeText}>Remove from pantry</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.link}
        onPress={onDone}
      >
        <Text style={styles.linkText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  product: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  productText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  body: { color: colors.subtle, fontSize: 13 },
  block: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtle,
    textTransform: "uppercase",
    marginTop: 14,
  },
  nameRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  small: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  smallOff: { opacity: 0.4 },
  smallText: { color: colors.primaryText, fontWeight: "800" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperGlyph: { fontSize: 24, color: colors.text },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  hint: { color: colors.subtle, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextOn: { color: colors.primaryText },
  remove: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeText: { color: colors.danger, fontWeight: "800" },
  link: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
