// Where things are kept: fridge, freezer, cupboard, and whatever else the
// kitchen actually has.
//
// Locations are records rather than a fixed set, so adding a cellar is a row
// and not a migration of every existing entry.

import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePantry } from "../state/PantryStore";
import { colors } from "../theme";

interface LocationsScreenProps {
  onDone: () => void;
}

export default function LocationsScreen({ onDone }: LocationsScreenProps) {
  const { entries, locations, addLocation, renameLocation, removeLocation } =
    usePantry();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  /** The location awaiting a "where should its entries go?" answer. */
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Counts include out-of-stock entries: they still reference the location, and
  // leaving them pointing at a removed one is exactly the orphan the
  // reassignment exists to prevent.
  const counts = useMemo(() => {
    const byLocation: Record<string, number> = {};
    for (const entry of Object.values(entries)) {
      if (entry.deletedAt !== null) continue;
      byLocation[entry.locationId] = (byLocation[entry.locationId] ?? 0) + 1;
    }
    return byLocation;
  }, [entries]);

  const isLast = locations.length <= 1;

  function startRemove(id: string) {
    if (isLast) return;
    const held = counts[id] ?? 0;
    if (held === 0) {
      // Nothing to move, so nothing to ask about.
      const destination = locations.find((l) => l.id !== id);
      if (destination) removeLocation(id, destination.id);
      return;
    }
    setRemovingId(id);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Places</Text>

      {locations.map((location) => {
        const held = counts[location.id] ?? 0;
        const isEditing = editingId === location.id;
        const isRemoving = removingId === location.id;

        return (
          <View key={location.id} style={styles.card}>
            {isEditing ? (
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  value={editingName}
                  onChangeText={setEditingName}
                  autoFocus
                  accessibilityLabel={`Rename ${location.name}`}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.small}
                  onPress={() => {
                    renameLocation(location.id, editingName);
                    setEditingId(null);
                  }}
                >
                  <Text style={styles.smallText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{location.name}</Text>
                  <Text style={styles.count}>
                    {held === 0
                      ? "empty"
                      : `${held} ${held === 1 ? "entry" : "entries"}`}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.action}
                  onPress={() => {
                    setEditingId(location.id);
                    setEditingName(location.name);
                  }}
                >
                  <Text style={styles.actionText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.action}
                  disabled={isLast}
                  onPress={() => startRemove(location.id)}
                >
                  <Text
                    style={[
                      styles.actionText,
                      styles.danger,
                      isLast && styles.off,
                    ]}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {isRemoving ? (
              <View style={styles.removal}>
                <Text style={styles.removalText}>
                  Move the {held} {held === 1 ? "entry" : "entries"} in{" "}
                  {location.name} to:
                </Text>
                <View style={styles.chips}>
                  {locations
                    .filter((other) => other.id !== location.id)
                    .map((other) => (
                      <TouchableOpacity
                        key={other.id}
                        accessibilityRole="button"
                        style={styles.chip}
                        onPress={() => {
                          removeLocation(location.id, other.id);
                          setRemovingId(null);
                        }}
                      >
                        <Text style={styles.chipText}>{other.name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.link}
                  onPress={() => setRemovingId(null)}
                >
                  <Text style={styles.linkText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}

      {isLast ? (
        <Text style={styles.hint}>
          The last place can't be removed — entries need somewhere to be.
        </Text>
      ) : null}

      <Text style={styles.label}>Add a place</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Cellar"
          placeholderTextColor={colors.subtle}
          accessibilityLabel="New place name"
          onSubmitEditing={() => {
            addLocation(newName);
            setNewName("");
          }}
        />
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.small, !newName.trim() && styles.smallOff]}
          disabled={!newName.trim()}
          onPress={() => {
            addLocation(newName);
            setNewName("");
          }}
        >
          <Text style={styles.smallText}>Add</Text>
        </TouchableOpacity>
      </View>

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
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtle,
    textTransform: "uppercase",
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  count: { fontSize: 12, color: colors.subtle },
  action: { paddingVertical: 6, paddingHorizontal: 8 },
  actionText: { fontWeight: "700", color: colors.primary },
  danger: { color: colors.danger },
  off: { opacity: 0.35 },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.bg,
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
  removal: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  removalText: { color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  chipText: { color: colors.primaryText, fontWeight: "700" },
  hint: { color: colors.subtle, fontSize: 13 },
  link: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
