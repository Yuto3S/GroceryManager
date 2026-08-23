// Adding something you have bought before, without scanning it again.

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
import AddSheet from "../components/AddSheet";
import { type CatalogueChoice, searchCatalogue } from "../lib/catalogue";
import { usePantry } from "../state/PantryStore";
import {
  type AddProductInput,
  productInputForRecord,
} from "../state/pantryReducer";
import { colors } from "../theme";

interface CatalogueAddScreenProps {
  onDone: () => void;
  onCancel: () => void;
  /** Offered when the catalogue is empty; there is nothing to pick from yet. */
  onScan: () => void;
  onType: () => void;
}

export default function CatalogueAddScreen({
  onDone,
  onCancel,
  onScan,
  onType,
}: CatalogueAddScreenProps) {
  const { catalogue } = usePantry();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<AddProductInput | null>(null);

  const results = useMemo(
    () => searchCatalogue(catalogue, query),
    [catalogue, query],
  );
  const isEmpty = Object.keys(catalogue).length === 0;

  if (product) {
    // Back to the list, not out of the screen — cancelling one product is not
    // cancelling the search that found it.
    return (
      <AddSheet
        product={product}
        onDone={onDone}
        onCancel={() => setProduct(null)}
      />
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.centre}>
        <Text style={styles.title}>Nothing here yet</Text>
        <Text style={styles.body}>
          Products you add show up here, so the second time is a tap.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={onScan}
        >
          <Text style={styles.buttonText}>Scan a barcode</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.link}
          onPress={onType}
        >
          <Text style={styles.linkText}>Type a name instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderRow(record: CatalogueChoice) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.row}
        onPress={() => setProduct(productInputForRecord(record))}
      >
        {record.imageUrl ? (
          <Image source={{ uri: record.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>
            {record.needsName ? "Unnamed product" : record.name}
          </Text>
          {record.brand ? (
            <Text style={styles.rowBrand} numberOfLines={1}>
              {record.brand}
            </Text>
          ) : null}
        </View>
        <Text style={styles.uses}>{record.useCount}×</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search what you've bought before"
        placeholderTextColor={colors.subtle}
        accessibilityLabel="Search the catalogue"
      />
      {results.length === 0 ? (
        <View style={styles.centre}>
          <Text style={styles.body}>Nothing matches “{query}”.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(record) => record.key}
          renderItem={({ item }) => renderRow(item)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        />
      )}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.link}
        onPress={onCancel}
      >
        <Text style={styles.linkText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  search: {
    margin: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  list: { paddingBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.bg },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowBrand: { fontSize: 12, color: colors.subtle },
  uses: { fontSize: 12, fontWeight: "700", color: colors.subtle },
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
