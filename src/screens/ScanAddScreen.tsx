// Scan one barcode, look it up, land on the add sheet.
//
// Single-shot: the camera stops on the first successful read. Continuous
// scanning for bootstrapping a whole kitchen is its own flow, in its own change.

import {
  type BarcodeScanningResult,
  type BarcodeType,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { lookupProduct } from "../api/openFoodFacts";
import AddSheet from "../components/AddSheet";
import { extractBarcode } from "../lib/barcode";
import { usePantry } from "../state/PantryStore";
import {
  type AddProductInput,
  productInputFor,
  productInputForUnknownBarcode,
} from "../state/pantryReducer";
import { colors } from "../theme";

// Barcode formats worth scanning for groceries. QR is included because some
// products now carry GS1 Digital Link QR codes that embed the product number.
const BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e", "qr"];

type Status =
  | { state: "scanning" }
  | { state: "looking-up" }
  | { state: "ready"; product: AddProductInput; note: string | null }
  | { state: "error"; message: string };

interface ScanAddScreenProps {
  onDone: () => void;
  onCancel: () => void;
}

export default function ScanAddScreen({
  onDone,
  onCancel,
}: ScanAddScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ state: "scanning" });
  const { productCache, cacheProduct } = usePantry();

  // The camera fires this many times a second; without a latch we would start
  // a lookup per frame.
  const lockRef = useRef(false);

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (lockRef.current) return;

      const barcode = extractBarcode(result.data);
      if (barcode === null) {
        lockRef.current = true;
        setStatus({
          state: "error",
          message: "That code doesn't contain a product barcode.",
        });
        return;
      }

      lockRef.current = true;
      setStatus({ state: "looking-up" });

      // A product we have seen before resolves without a request at all.
      const cached = productCache[barcode];
      if (cached) {
        const input = productInputFor(cached);
        if (input) {
          setStatus({
            state: "ready",
            product: input,
            note: "From your device",
          });
          return;
        }
      }

      try {
        const product = await lookupProduct(barcode);
        if (product) {
          cacheProduct(product);
          const input = productInputFor(product);
          if (input) {
            setStatus({ state: "ready", product: input, note: null });
            return;
          }
        }
        // Not in the database — still addable, just unnamed.
        setStatus({
          state: "ready",
          product: productInputForUnknownBarcode(barcode),
          note: "Not in the database — add it and name it yourself.",
        });
      } catch {
        // Offline, or the lookup timed out. Same answer: the user is holding
        // the thing, so let them record it.
        setStatus({
          state: "ready",
          product: productInputForUnknownBarcode(barcode),
          note: "Couldn't reach the database — you can name it later.",
        });
      }
    },
    [productCache, cacheProduct],
  );

  function scanAgain() {
    lockRef.current = false;
    setStatus({ state: "scanning" });
  }

  if (!permission) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centre}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>
          Scanning reads the barcode on the packet. Nothing leaves your device
          except the barcode number.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.link}
          onPress={onCancel}
        >
          <Text style={styles.linkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status.state === "ready") {
    return (
      <View style={styles.root}>
        {status.note ? <Text style={styles.note}>{status.note}</Text> : null}
        <AddSheet
          product={status.product}
          onDone={onDone}
          onCancel={onCancel}
        />
      </View>
    );
  }

  if (status.state === "error") {
    return (
      <View style={styles.centre}>
        <Text style={styles.title}>Not a product barcode</Text>
        <Text style={styles.body}>{status.message}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={scanAgain}
        >
          <Text style={styles.buttonText}>Scan again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.link}
          onPress={onCancel}
        >
          <Text style={styles.linkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={handleScan}
      />
      {/*
        A way out of the camera. Without this the only exit is the OS back
        gesture, which is not an affordance — the screen fills with a live
        viewfinder and nothing on it says you can leave.
      */}
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Cancel scanning"
          testID="scan-cancel"
          style={styles.pill}
          onPress={onCancel}
        >
          <Text style={styles.pillText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {status.state === "looking-up"
            ? "Looking it up…"
            : "Point at the barcode"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  camera: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "flex-start",
    padding: 12,
    // The status bar, without reaching for a safe-area provider that nothing
    // else in this screen needs. Matches the rapid-scan overlay's approach.
    paddingTop: 56,
  },
  pill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  pillText: { color: colors.primaryText, fontWeight: "700" },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: "center",
  },
  overlayText: {
    color: colors.primaryText,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    fontWeight: "700",
  },
  note: {
    padding: 12,
    color: colors.subtle,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: colors.bg,
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
  link: { paddingVertical: 10 },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
