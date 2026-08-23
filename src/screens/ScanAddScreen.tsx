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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  /**
   * A barcode to treat as if the camera had read it. Development only — see
   * `src/lib/devScan.ts`. The simulator has no camera, so this is the only way
   * an automated flow reaches anything past the viewfinder.
   */
  injectedBarcode?: string | null;
}

export default function ScanAddScreen({
  onDone,
  onCancel,
  injectedBarcode = null,
}: ScanAddScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera is full-bleed by design, so the controls over it carry the
  // inset rather than the screen. A guessed paddingTop was wrong on every
  // device that was not the one it was guessed on.
  const insets = useSafeAreaInsets();
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

  // Fires once, through `handleScan` rather than beside it: an injection that
  // took a shortcut past the debounce and the cache would be testing a code
  // path that does not exist in the real app.
  useEffect(() => {
    if (injectedBarcode === null) return;
    void handleScan({ data: injectedBarcode } as BarcodeScanningResult);
  }, [injectedBarcode, handleScan]);

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
          testID="grant-camera"
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
    // This route is mounted edge-to-edge so the *camera* can fill the screen,
    // but the add sheet is not a camera. It carries the top inset itself
    // rather than the route granting one the viewfinder would then have to
    // fight.
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
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
        The way out, and the status caption, in one bar at the bottom — the
        same place and the same shape as rapid mode's Pause. Two screens doing
        the same job should not put the same control in two different corners,
        and the bottom is the half of the screen you can reach while holding
        the phone up to a packet.
      */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.hint}>
          {status.state === "looking-up"
            ? "Looking it up…"
            : "Point at the barcode"}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel scanning"
            testID="scan-cancel"
            style={styles.cameraAction}
            onPress={onCancel}
          >
            <Text style={styles.cameraActionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  camera: { flex: 1 },
  // Mirrors RapidScanScreen's bottom bar, deliberately: the two camera screens
  // should read as the same screen with a different job.
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  hint: { color: colors.primaryText, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  // Bounded and outlined, so the tap target is the thing you can see. As a
  // bare label it was the width of the word while the bar behind it spanned
  // the screen — which reads as a full-width button that mostly does nothing.
  cameraAction: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  cameraActionText: { color: colors.primaryText, fontWeight: "700" },
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
