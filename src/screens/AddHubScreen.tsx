// The ways into the pantry. They all end at the same sheet, or — for rapid mode
// — at the same review.

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { isScanningAvailable } from "../lib/scanning";
import { usePantry } from "../state/PantryStore";
import { useScanSession } from "../state/ScanSessionStore";
import { colors } from "../theme";

export default function AddHubScreen() {
  const router = useRouter();
  const { catalogue } = usePantry();
  const { unfinished, resumePending, discardPending } = useScanSession();
  const known = Object.keys(catalogue).length;

  // Availability is a resolved state, not a synchronous guess. In a browser the
  // `BarcodeDetector` constructor can exist while the platform behind it reads
  // nothing, so the only honest answer comes from asking it what it supports.
  // Null means "still asking" — no scanning control is shown until it is known.
  const [canScan, setCanScan] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    isScanningAvailable().then((available) => {
      if (current) setCanScan(available);
    });
    return () => {
      current = false;
    };
  }, []);

  const pendingCount = unfinished?.items.length ?? 0;

  return (
    // Scrolls, because the content is not a fixed height: the resume banner
    // appears and disappears, and the last option was falling behind the tab
    // bar whenever it was there.
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {unfinished ? (
        // Never revived silently: the user would otherwise confirm forty items
        // believing they had just scanned them.
        <View style={styles.resume} testID="resume-banner">
          <Text style={styles.resumeTitle}>
            You have an unfinished scan of {pendingCount}{" "}
            {pendingCount === 1 ? "product" : "products"}
          </Text>
          <Text style={styles.resumeBody}>
            Started {new Date(unfinished.startedAt).toLocaleString()}
          </Text>
          <View style={styles.resumeActions}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.resumeGo}
              testID="resume-go"
              onPress={() => {
                resumePending();
                router.push("/add/review");
              }}
            >
              <Text style={styles.resumeGoText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.resumeDrop}
              testID="resume-discard"
              onPress={discardPending}
            >
              <Text style={styles.resumeDropText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {canScan === true ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.primary}
            testID="go-rapid-scan"
            onPress={() => router.push("/add/rapid")}
          >
            <Text style={styles.primaryGlyph}>▦</Text>
            <Text style={styles.primaryText}>Rapid scan</Text>
            <Text style={styles.primaryBody}>
              Camera stays on — work along a shelf, review at the end
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.option}
            testID="go-scan-one"
            onPress={() => router.push("/add/scan")}
          >
            <Text style={styles.optionTitle}>Scan one thing</Text>
            <Text style={styles.optionBody}>
              For a single item after shopping
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {canScan === false ? (
        <View style={styles.unavailable}>
          <Text style={styles.optionTitle}>Scanning isn't available here</Text>
          <Text style={styles.optionBody}>
            This browser has no barcode reader. Use the app on your phone to
            scan; you can still add things by name below.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.option}
        testID="go-catalogue"
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
        testID="go-manual-add"
        onPress={() => router.push("/add/manual")}
      >
        <Text style={styles.optionTitle}>Type a name</Text>
        <Text style={styles.optionBody}>
          For loose fruit and veg, and anything without a barcode
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  resume: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 14,
    gap: 6,
  },
  resumeTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  resumeBody: { fontSize: 12, color: colors.subtle },
  resumeActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  resumeGo: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  resumeGoText: { color: colors.primaryText, fontWeight: "800" },
  resumeDrop: { paddingVertical: 10, paddingHorizontal: 16 },
  resumeDropText: { color: colors.danger, fontWeight: "700" },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 4,
  },
  primaryGlyph: { fontSize: 32, color: colors.primaryText },
  primaryText: { fontSize: 17, fontWeight: "800", color: colors.primaryText },
  primaryBody: {
    fontSize: 12,
    color: colors.primaryText,
    opacity: 0.85,
    textAlign: "center",
  },
  option: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  unavailable: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  optionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  optionBody: { fontSize: 13, color: colors.subtle },
});
