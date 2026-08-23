// Adding something with no barcode — a tomato, a loaf from the bakery.

import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import AddSheet from "../components/AddSheet";
import {
  type AddProductInput,
  productInputForName,
} from "../state/pantryReducer";
import { colors } from "../theme";

interface ManualAddScreenProps {
  onDone: () => void;
  onCancel: () => void;
  /**
   * What to start the box with.
   *
   * The produce picker hands over whatever was searched for when nothing
   * matched, so a miss there costs a tap rather than typing it again.
   */
  initialName?: string;
}

export default function ManualAddScreen({
  onDone,
  onCancel,
  initialName = "",
}: ManualAddScreenProps) {
  // A plain initialiser is right here, unlike the add sheet's defaults: this
  // value comes from the route, not from anything the store hydrates later.
  const [name, setName] = useState(initialName);
  const [product, setProduct] = useState<AddProductInput | null>(null);

  if (product) {
    // Back to the name box, with what was typed still in it. Cancelling the
    // sheet means "not these details", not "forget the name I just typed".
    return (
      <AddSheet
        product={product}
        onDone={onDone}
        onCancel={() => setProduct(null)}
      />
    );
  }

  // Null means the name normalized to nothing — punctuation, spaces, emoji.
  // A product with no usable name has no identity and cannot be catalogued.
  const next = productInputForName(name);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.label}>What is it?</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Tomatoes"
        placeholderTextColor={colors.subtle}
        autoFocus
        accessibilityLabel="Product name"
        testID="manual-name-input"
        returnKeyType="next"
        onSubmitEditing={() => next && setProduct(next)}
      />
      <Text style={styles.hint}>
        Typing the same name again finds the one you added before, whatever the
        capitals and accents.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.button, !next && styles.buttonOff]}
        disabled={!next}
        onPress={() => next && setProduct(next)}
        testID="manual-continue"
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.link}
        onPress={onCancel}
      >
        <Text style={styles.linkText}>Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtle,
    textTransform: "uppercase",
  },
  input: {
    padding: 14,
    borderRadius: 10,
    fontSize: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  hint: { color: colors.subtle, fontSize: 13 },
  button: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: colors.primaryText, fontWeight: "800", fontSize: 16 },
  link: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
