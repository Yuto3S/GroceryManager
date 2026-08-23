// The one sheet every add path ends at.
//
// Scanning a barcode, picking from the catalogue and typing a name all resolve
// a product and then hand it here, so there is a single place that decides how
// much of something there is and where it goes — and a single place to fix when
// that decision changes.

import { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addDefaultsFor, measureLabel } from "../lib/catalogue";
import { usePantry } from "../state/PantryStore";
import type { AddProductInput } from "../state/pantryReducer";
import { colors } from "../theme";
import type { Unit } from "../types";

interface AddSheetProps {
  product: AddProductInput;
  /** Called after the entry is created. */
  onDone: () => void;
  onCancel: () => void;
}

export default function AddSheet({ product, onDone, onCancel }: AddSheetProps) {
  const { catalogue, locations, addProduct } = usePantry();

  const record = catalogue[product.key] ?? null;
  const defaults = useMemo(
    () => addDefaultsFor(record, product.quantityText),
    [record, product.quantityText],
  );

  // Every field is held as an override that falls back to the computed default,
  // rather than seeded into state with an initialiser.
  //
  // That is not a style choice. The store hydrates from AsyncStorage
  // asynchronously, so on the first render the catalogue is empty and there are
  // no locations yet. A `useState(defaults.x)` initialiser runs exactly once, at
  // that moment, and would freeze in the pre-hydration answer — silently
  // throwing away the step and location this product was added with last time,
  // which is the entire point of the catalogue.
  const [byCountOverride, setByCountOverride] = useState<boolean | null>(null);
  const [countAmountOverride, setCountAmountOverride] = useState<number | null>(
    null,
  );
  const [countStepOverride, setCountStepOverride] = useState<number | null>(
    null,
  );
  const [measureAmountOverride, setMeasureAmountOverride] = useState<
    number | null
  >(null);
  const [measureStepOverride, setMeasureStepOverride] = useState<number | null>(
    null,
  );
  const [locationOverride, setLocationOverride] = useState<string | null>(null);

  const byCount = byCountOverride ?? defaults.unit === "piece";
  const countAmount = countAmountOverride ?? defaults.countAmount;
  const countStep = countStepOverride ?? defaults.countStep;
  const measureAmount = measureAmountOverride ?? defaults.measureAmount;
  const measureStep = measureStepOverride ?? defaults.measureStep;

  // A remembered location that has since been removed must not silently become
  // the destination, so each candidate is checked against the live list.
  const locationId = useMemo(() => {
    const candidates = [locationOverride, defaults.locationId];
    for (const candidate of candidates) {
      if (candidate && locations.some((l) => l.id === candidate))
        return candidate;
    }
    return locations[0]?.id ?? null;
  }, [locationOverride, defaults.locationId, locations]);

  const amount = byCount ? countAmount : measureAmount;
  const step = byCount ? countStep : measureStep;
  const setAmount = byCount ? setCountAmountOverride : setMeasureAmountOverride;
  const setStep = byCount ? setCountStepOverride : setMeasureStepOverride;
  const unit: Unit = byCount ? "piece" : defaults.measureUnit;
  const suffix = byCount ? "" : ` ${defaults.measureUnit}`;

  /**
   * Switch between counting and measuring, discarding any edits to the form
   * being switched to so it shows this product's defaults rather than a
   * half-finished number from earlier in the same visit.
   */
  function switchForm(toCount: boolean) {
    setByCountOverride(toCount);
    if (toCount) {
      setCountAmountOverride(null);
      setCountStepOverride(null);
    } else {
      setMeasureAmountOverride(null);
      setMeasureStepOverride(null);
    }
  }

  const canConfirm = locationId !== null && amount > 0 && step > 0;

  function confirm() {
    if (locationId === null) return;
    addProduct({
      product,
      amount,
      unit,
      step,
      measureUnit: defaults.measureUnit,
      locationId,
    });
    onDone();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.product}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Text style={styles.thumbGlyph}>▣</Text>
          </View>
        )}
        <View style={styles.productText}>
          <Text style={styles.name} numberOfLines={2}>
            {product.needsName ? "Unnamed product" : product.name}
          </Text>
          {product.brand ? (
            <Text style={styles.brand}>{product.brand}</Text>
          ) : null}
          {product.needsName ? (
            <Text style={styles.warn}>
              Not found — you can name it after adding
            </Text>
          ) : null}
        </View>
      </View>

      {/* Exactly two ways to say how much, and the measure unit is the app's
          decision rather than a third question for the user. */}
      <Text style={styles.label}>How is it measured?</Text>
      <View style={styles.segmented}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: byCount }}
          style={[styles.segment, byCount && styles.segmentOn]}
          onPress={() => switchForm(true)}
        >
          <Text style={[styles.segmentText, byCount && styles.segmentTextOn]}>
            Count
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: !byCount }}
          style={[styles.segment, !byCount && styles.segmentOn]}
          onPress={() => switchForm(false)}
        >
          <Text style={[styles.segmentText, !byCount && styles.segmentTextOn]}>
            {measureLabel(defaults.measureUnit)}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>How much?</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Less"
          style={styles.stepperButton}
          onPress={() => setAmount(Math.max(step, amount - step))}
        >
          <Text style={styles.stepperGlyph}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>
          {amount}
          {suffix}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="More"
          style={styles.stepperButton}
          onPress={() => setAmount(amount + step)}
        >
          <Text style={styles.stepperGlyph}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Each tap uses</Text>
      <View style={styles.stepRow}>
        <TextInput
          style={styles.stepInput}
          keyboardType="number-pad"
          value={String(step)}
          accessibilityLabel="Consume step"
          onChangeText={(text) => {
            const parsed = Number.parseInt(text.replace(/\D/g, ""), 10);
            setStep(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
          }}
        />
        <Text style={styles.stepSuffix}>
          {byCount ? (step === 1 ? "item" : "items") : defaults.measureUnit}
        </Text>
      </View>

      <Text style={styles.label}>Where does it go?</Text>
      <View style={styles.chips}>
        {locations.map((location) => {
          const selected = location.id === locationId;
          return (
            <TouchableOpacity
              key={location.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => setLocationOverride(location.id)}
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
        style={[styles.confirm, !canConfirm && styles.confirmOff]}
        disabled={!canConfirm}
        testID="add-confirm"
        onPress={confirm}
      >
        <Text style={styles.confirmText}>Add to pantry</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.cancel}
        onPress={onCancel}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  product: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbGlyph: { fontSize: 24, color: colors.subtle },
  productText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  brand: { fontSize: 13, color: colors.subtle },
  warn: { fontSize: 12, color: colors.danger },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtle,
    textTransform: "uppercase",
    marginTop: 12,
  },
  segmented: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontWeight: "700", color: colors.text },
  segmentTextOn: { color: colors.primaryText },
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
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepInput: {
    width: 90,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  stepSuffix: { color: colors.subtle },
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
  confirm: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  confirmOff: { opacity: 0.4 },
  confirmText: { color: colors.primaryText, fontWeight: "800", fontSize: 16 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: colors.subtle, fontWeight: "600" },
});
