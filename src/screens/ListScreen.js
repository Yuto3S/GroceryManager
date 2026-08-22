// List screen: your grocery list. Add items by hand, check them off as you
// buy them, and see what you've already bought.

import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useGrocery } from "../state/GroceryStore";
import { colors, nutriColors } from "../theme";

function Row({ item, onToggle, onRemove }) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.checkbox, item.bought && styles.checkboxOn]}
        onPress={() => onToggle(item.id)}
        hitSlop={8}
      >
        {item.bought && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.thumb}
          resizeMode="contain"
        />
      ) : null}

      <View style={styles.rowText}>
        <Text
          style={[styles.itemName, item.bought && styles.itemNameDone]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {(item.brand || item.nutriScore) && (
          <View style={styles.metaRow}>
            {!!item.brand && <Text style={styles.meta}>{item.brand}</Text>}
            {!!item.nutriScore && (
              <View
                style={[
                  styles.nutriDot,
                  {
                    backgroundColor:
                      nutriColors[item.nutriScore] || colors.subtle,
                  },
                ]}
              >
                <Text style={styles.nutriDotText}>{item.nutriScore}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={8}>
        <Text style={styles.remove}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ListScreen() {
  const { items, addManualItem, toggleBought, removeItem, clearBought } =
    useGrocery();
  const [text, setText] = useState("");

  const { toBuy, bought } = useMemo(() => {
    return {
      toBuy: items.filter((i) => !i.bought),
      bought: items.filter((i) => i.bought),
    };
  }, [items]);

  const submit = () => {
    addManualItem(text);
    setText("");
  };

  // Build a single sectioned data array for one FlatList.
  const data = useMemo(() => {
    const out = [
      { type: "header", key: "h-tobuy", label: `To buy (${toBuy.length})` },
    ];
    if (toBuy.length === 0) {
      out.push({ type: "empty", key: "e-tobuy", label: "Nothing to buy yet." });
    } else {
      for (const it of toBuy) {
        out.push({ type: "item", key: it.id, item: it });
      }
    }
    out.push({
      type: "header",
      key: "h-bought",
      label: `Bought (${bought.length})`,
      showClear: bought.length > 0,
    });
    if (bought.length === 0) {
      out.push({
        type: "empty",
        key: "e-bought",
        label: "Nothing bought yet.",
      });
    } else {
      for (const it of bought) {
        out.push({ type: "item", key: it.id, item: it });
      }
    }
    return out;
  }, [toBuy, bought]);

  const renderItem = ({ item: row }) => {
    if (row.type === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{row.label}</Text>
          {row.showClear && (
            <TouchableOpacity onPress={clearBought} hitSlop={8}>
              <Text style={styles.clear}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    if (row.type === "empty") {
      return <Text style={styles.emptyText}>{row.label}</Text>;
    }
    return (
      <Row item={row.item} onToggle={toggleBought} onRemove={removeItem} />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.addBar}>
        <TextInput
          style={styles.input}
          placeholder="Add an item…"
          placeholderTextColor={colors.subtle}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={submit}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  addBar: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  addBtnText: { color: colors.primaryText, fontWeight: "700", fontSize: 16 },
  listContent: { padding: 12, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clear: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  emptyText: { color: colors.subtle, paddingVertical: 8, fontStyle: "italic" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary },
  checkmark: { color: "#fff", fontWeight: "800", fontSize: 15 },
  thumb: { width: 40, height: 40, borderRadius: 8 },
  rowText: { flex: 1 },
  itemName: { fontSize: 16, color: colors.text, fontWeight: "600" },
  itemNameDone: {
    textDecorationLine: "line-through",
    color: colors.subtle,
    fontWeight: "500",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  meta: { fontSize: 13, color: colors.subtle },
  nutriDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  nutriDotText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  remove: { color: colors.subtle, fontSize: 18, paddingHorizontal: 4 },
});
