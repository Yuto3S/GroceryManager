// Continuous scanning: the camera stays live and every read is accepted
// immediately.
//
// The whole point is that nothing on the scan path can fail slowly. A barcode is
// extracted, debounced, queued and acknowledged synchronously; the product
// lookup is a background side effect that patches the queued item whenever it
// arrives, or never. An unresolved item is a normal outcome, not an error — it
// is the same mechanism that makes scanning work with no signal at all.

import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
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
import { extractBarcode } from "../lib/barcode";
import {
  feedbackForIncrement,
  feedbackForNewItem,
  feedbackForRejected,
  feedbackForUnresolved,
} from "../lib/feedback";
import { BARCODE_TYPES } from "../lib/scanning";
import { usePantry } from "../state/PantryStore";
import { useScanSession } from "../state/ScanSessionStore";
import { RESCAN_DEBOUNCE_MS } from "../state/scanSession";
import { colors } from "../theme";

/**
 * How many lookups may be in flight at once.
 *
 * A bootstrap is exactly the moment this app looks most like abuse to a free,
 * community-run service, so the queue drains steadily rather than firing a
 * hundred requests the moment someone walks along a shelf.
 */
const MAX_CONCURRENT_LOOKUPS = 3;

/** What the last scan did, shown just long enough to be read. */
interface Acknowledgement {
  barcode: string;
  label: string;
  count: number;
  kind: "added" | "incremented" | "rejected";
}

interface RapidScanScreenProps {
  onReview: () => void;
  onCancel: () => void;
  /**
   * Barcodes to treat as if the camera had read them, in order. Development
   * only — see `src/lib/devScan.ts`. Several are allowed because a rapid
   * session with one item does not exercise anything rapid mode exists for.
   */
  injectedBarcodes?: readonly string[];
}

export default function RapidScanScreen({
  onReview,
  onCancel,
  injectedBarcodes,
}: RapidScanScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  // Full-bleed camera: the picture reaches the corners, the controls over it
  // do not. The bottom bar was running into the home indicator.
  const insets = useSafeAreaInsets();
  const { locations, productCache, cacheProduct } = usePantry();
  const {
    session,
    startSession,
    setSessionLocation,
    recordScan,
    resolveItem,
    decrementItem,
  } = useScanSession();

  const [ack, setAck] = useState<Acknowledgement | null>(null);

  // Scanning for several minutes with the camera live is exactly the case the
  // screen would otherwise sleep through.
  useKeepAwake();

  // Barcodes waiting on a lookup, and how many are in flight. Refs rather than
  // state: the scan path must not re-render to enqueue, and these are
  // bookkeeping rather than anything the user sees.
  const queueRef = useRef<string[]>([]);
  const inFlightRef = useRef(0);
  const requestedRef = useRef<Set<string>>(new Set());

  const drain = useCallback(() => {
    while (
      inFlightRef.current < MAX_CONCURRENT_LOOKUPS &&
      queueRef.current.length > 0
    ) {
      const barcode = queueRef.current.shift();
      if (barcode === undefined) break;

      inFlightRef.current += 1;
      lookupProduct(barcode)
        .then((product) => {
          if (product) {
            cacheProduct(product);
            resolveItem(barcode, product);
          } else {
            // Not in the database. Still queued, still addable, flagged for
            // review — the user is holding the thing either way.
            feedbackForUnresolved();
          }
        })
        .catch(() => {
          // Offline or timed out. Identical handling, deliberately: both mean
          // "we could not name it", and neither is a reason to lose the scan.
          feedbackForUnresolved();
        })
        .finally(() => {
          inFlightRef.current -= 1;
          drain();
        });
    }
  }, [cacheProduct, resolveItem]);

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      // No `await` anywhere below this line. That is the requirement.
      const barcode = extractBarcode(data);
      if (barcode === null) {
        feedbackForRejected();
        setAck({
          barcode: "",
          label: "Not a product barcode",
          count: 0,
          kind: "rejected",
        });
        return;
      }

      const outcome = recordScan(barcode);
      if (outcome === "ignored-duplicate" || outcome === "no-session") return;

      if (outcome === "added") feedbackForNewItem();
      else feedbackForIncrement();

      const known = productCache[barcode] ?? null;
      const item = session?.items.find((i) => i.barcode === barcode);
      setAck({
        barcode,
        label: known?.name ?? item?.product?.name ?? barcode,
        count: outcome === "added" ? 1 : (item?.count ?? 1) + 1,
        kind: outcome,
      });

      // A product already on the device resolves without a request at all.
      if (known) {
        resolveItem(barcode, known);
        return;
      }

      if (!requestedRef.current.has(barcode)) {
        requestedRef.current.add(barcode);
        queueRef.current.push(barcode);
        drain();
      }
    },
    [recordScan, productCache, session, resolveItem, drain],
  );

  // Start a session as soon as there is somewhere to put things.
  useEffect(() => {
    if (session === null && locations.length > 0) {
      const first = locations[0];
      if (first) startSession(first.id);
    }
  }, [session, locations, startSession]);

  // Feed injected barcodes in once a session exists, spaced past the debounce
  // so each one counts as a deliberate scan rather than a camera repeat — the
  // same thing a person's hand does, at the same rhythm.
  const injectedRef = useRef(false);
  useEffect(() => {
    if (!injectedBarcodes || injectedBarcodes.length === 0) return;
    if (session === null || injectedRef.current) return;
    injectedRef.current = true;

    let cancelled = false;
    (async () => {
      for (const barcode of injectedBarcodes) {
        if (cancelled) return;
        handleScan({ data: barcode });
        await new Promise((r) => setTimeout(r, RESCAN_DEBOUNCE_MS + 200));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [injectedBarcodes, session, handleScan]);

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
          Rapid mode keeps the camera on so you can work along a shelf. Only the
          barcode number leaves your device.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.permissionButton}
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
          <Text style={styles.permissionLinkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanned = session?.items.length ?? 0;
  const total = session?.items.reduce((sum, i) => sum + i.count, 0) ?? 0;
  const currentLocation = locations.find((l) => l.id === session?.locationId);

  return (
    <View style={styles.root}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={handleScan}
      />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.count} accessibilityLabel="Items scanned">
          {scanned === 0
            ? "Nothing scanned yet"
            : `${scanned} ${scanned === 1 ? "product" : "products"} · ${total} scanned`}
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {ack ? (
          <View style={styles.ack}>
            <Text style={styles.ackText} numberOfLines={1}>
              {ack.kind === "rejected"
                ? ack.label
                : `${ack.label}${ack.count > 1 ? `  ×${ack.count}` : ""}`}
            </Text>
            {ack.kind === "incremented" ? (
              // The distinction between "I scanned twice" and "the camera
              // caught it twice" is the user's intent, and only they know it.
              // A one-tap correction makes any debounce threshold survivable.
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Undo that increase"
                style={styles.undo}
                onPress={() => {
                  decrementItem(ack.barcode);
                  setAck(null);
                }}
              >
                <Text style={styles.undoText}>Undo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <Text style={styles.hint}>Point at a barcode — keep going</Text>
        )}

        <View style={styles.places}>
          {locations.map((location) => {
            const selected = location.id === session?.locationId;
            return (
              <TouchableOpacity
                key={location.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.place, selected && styles.placeOn]}
                onPress={() => setSessionLocation(location.id)}
              >
                <Text
                  style={[styles.placeText, selected && styles.placeTextOn]}
                >
                  {location.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hintSmall}>
          Scanning into {currentLocation?.name ?? "…"}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.link}
            testID="rapid-pause"
            onPress={onCancel}
          >
            <Text style={styles.linkText}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.button, scanned === 0 && styles.buttonOff]}
            testID="rapid-review"
            disabled={scanned === 0}
            onPress={onReview}
          >
            <Text style={styles.buttonText}>Review {scanned || ""}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  camera: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: colors.bg,
  },
  top: { alignItems: "center" },
  count: {
    color: colors.primaryText,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    fontWeight: "700",
  },
  bottom: {
    marginTop: "auto",
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  ack: { flexDirection: "row", alignItems: "center", gap: 10 },
  ackText: {
    flex: 1,
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "700",
  },
  undo: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  undoText: { fontWeight: "800", color: colors.text },
  hint: { color: colors.primaryText, opacity: 0.8 },
  hintSmall: { color: colors.primaryText, opacity: 0.7, fontSize: 12 },
  places: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  place: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  placeOn: { backgroundColor: colors.primary },
  placeText: { color: colors.primaryText, fontWeight: "600" },
  placeTextOn: { color: colors.primaryText },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  body: { color: colors.subtle, textAlign: "center" },
  // The action button in the bottom bar shares the row with "Pause", so it
  // takes the remaining width.
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  // The permission screen is a centred column on a light background, so it
  // needs its own button: `flex: 1` there would stretch it down the whole
  // screen, and the overlay's white link text would be invisible.
  permissionButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  permissionLinkText: { color: colors.subtle, fontWeight: "600" },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: colors.primaryText, fontWeight: "800" },
  // Matches ScanAddScreen's Cancel: an outlined pill, so the control's bounds
  // are visible rather than implied by a full-width bar behind it.
  link: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  linkText: { color: colors.primaryText, fontWeight: "700" },
});
