// Scan screen: point the camera at a product barcode (or QR code),
// look it up on Open Food Facts, and add it to your grocery list.

import {
  type BarcodeScanningResult,
  type BarcodeType,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { lookupProduct } from "../api/openFoodFacts";
import { extractBarcode } from "../lib/barcode";
import { useGrocery } from "../state/GroceryStore";
import { colors, nutriColorFor } from "../theme";
import type { Product } from "../types";

// Barcode formats worth scanning for groceries. QR is included because some
// products now carry GS1 Digital Link QR codes that embed the product number.
const BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e", "qr"];

type Status =
  | "scanning"
  | "loading"
  | "result"
  | "notfound"
  | "invalid"
  | "error";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { addProduct, productCache, cacheProduct } = useGrocery();

  const [status, setStatus] = useState<Status>("scanning");
  const [product, setProduct] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastCode, setLastCode] = useState("");
  const lockRef = useRef(false); // prevents a burst of duplicate scans

  const handleScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (lockRef.current) return;
      lockRef.current = true;

      const code = extractBarcode(data);

      // A QR code that holds no product number at all (a link, a Wi-Fi config,
      // whatever). Stop here instead of sending its contents to Open Food Facts.
      if (!code) {
        setStatus("invalid");
        return;
      }

      setLastCode(code);
      setStatus("loading");

      try {
        // Offline-friendly: use the cached product if we've seen it before.
        const cached = productCache[code];
        if (cached) {
          setProduct(cached);
          setStatus("result");
          return;
        }
        const found = await lookupProduct(code);
        if (found) {
          cacheProduct(found);
          setProduct(found);
          setStatus("result");
        } else {
          setStatus("notfound");
        }
      } catch (e) {
        setErrorMsg(
          (e instanceof Error && e.message) || "Something went wrong",
        );
        setStatus("error");
      }
    },
    [productCache, cacheProduct],
  );

  const resetToScan = useCallback(() => {
    setProduct(null);
    setErrorMsg("");
    setStatus("scanning");
    lockRef.current = false;
  }, []);

  // --- Permission states ---
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.subtle}>
          We use the camera only to read product barcodes.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Result / status card overlays the camera ---
  const showCamera = status === "scanning";

  return (
    <View style={styles.container}>
      {showCamera ? (
        // CameraView takes no children — the viewfinder is a sibling layered
        // on top of it, and stays out of the way of touches.
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={handleScanned}
          />
          <View
            style={[StyleSheet.absoluteFill, styles.overlay]}
            pointerEvents="none"
          >
            <View style={styles.frame} />
            <Text style={styles.hint}>Point at a product barcode</Text>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.resultWrap}>
          {status === "loading" && (
            <View style={styles.card}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.subtle}>Looking up {lastCode}…</Text>
            </View>
          )}

          {status === "result" && product && (
            <View style={styles.card}>
              {product.imageUrl ? (
                <Image
                  source={{ uri: product.imageUrl }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.productImage, styles.imagePlaceholder]}>
                  <Text style={{ color: colors.subtle }}>No image</Text>
                </View>
              )}
              <Text style={styles.productName}>{product.name}</Text>
              {!!product.brand && (
                <Text style={styles.subtle}>{product.brand}</Text>
              )}
              {!!product.quantity && (
                <Text style={styles.subtle}>{product.quantity}</Text>
              )}
              {product.nutriScore ? (
                <View
                  style={[
                    styles.nutriBadge,
                    { backgroundColor: nutriColorFor(product.nutriScore) },
                  ]}
                >
                  <Text style={styles.nutriText}>
                    Nutri-Score {product.nutriScore}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.codeText}>Barcode {product.barcode}</Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  addProduct(product, { bought: false });
                  resetToScan();
                }}
              >
                <Text style={styles.primaryBtnText}>Add to list</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  addProduct(product, { bought: true });
                  resetToScan();
                }}
              >
                <Text style={styles.secondaryBtnText}>
                  Add as already bought
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetToScan}>
                <Text style={styles.link}>Scan another</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "notfound" && (
            <View style={styles.card}>
              <Text style={styles.title}>Not in the database</Text>
              <Text style={styles.subtle}>
                Barcode {lastCode} wasn't found on Open Food Facts. You can
                still add it to your list by hand from the List tab.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={resetToScan}>
                <Text style={styles.primaryBtnText}>Scan again</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "invalid" && (
            <View style={styles.card}>
              <Text style={styles.title}>Not a product code</Text>
              <Text style={styles.subtle}>
                That code doesn't contain a barcode number. Try scanning the
                barcode on the packaging itself.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={resetToScan}>
                <Text style={styles.primaryBtnText}>Scan again</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "error" && (
            <View style={styles.card}>
              <Text style={styles.title}>Couldn't look that up</Text>
              <Text style={styles.subtle}>{errorMsg}</Text>
              <Text style={styles.subtle}>
                (Product lookup needs an internet connection.)
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={resetToScan}>
                <Text style={styles.primaryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.bg,
    gap: 12,
  },
  overlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
  },
  hint: {
    color: "#fff",
    marginTop: 16,
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resultWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  productImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 8,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtle: { fontSize: 15, color: colors.subtle, textAlign: "center" },
  codeText: { fontSize: 13, color: colors.subtle, marginTop: 4 },
  nutriBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  nutriText: { color: "#fff", fontWeight: "700" },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    width: "100%",
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 4,
    width: "100%",
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  link: { color: colors.subtle, marginTop: 14, fontSize: 15 },
});
