// The three ways into the pantry. They all end at the same sheet.

import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePantry } from "../state/PantryStore";
import { colors } from "../theme";

export default function AddHubScreen() {
  const router = useRouter();
  const { catalogue } = usePantry();
  const known = Object.keys(catalogue).length;

  return (
    <View style={styles.root}>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.primary}
        onPress={() => router.push("/add/scan")}
      >
        <Text style={styles.primaryGlyph}>▣</Text>
        <Text style={styles.primaryText}>Scan a barcode</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.option}
        onPress={() => router.push("/add/catalogue")}
      >
        <Text style={styles.optionTitle}>Add something you've had before</Text>
        <Text style={styles.optionBody}>
          {known === 0
            ? "Nothing here yet — products show up after the first add"
            : `${known} ${known === 1 ? "product" : "products"} remembered`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.option}
        onPress={() => router.push("/add/manual")}
      >
        <Text style={styles.optionTitle}>Type a name</Text>
        <Text style={styles.optionBody}>
          For loose fruit and veg, and anything without a barcode
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: "center",
    gap: 6,
  },
  primaryGlyph: { fontSize: 34, color: colors.primaryText },
  primaryText: { fontSize: 17, fontWeight: "800", color: colors.primaryText },
  option: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  optionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  optionBody: { fontSize: 13, color: colors.subtle },
});
