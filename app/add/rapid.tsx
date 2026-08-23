import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import SafeScreen from "../../src/components/SafeScreen";
import { devBarcodesFrom } from "../../src/lib/devScan";
import { goBackOr } from "../../src/lib/navigation";
import RapidScanScreen from "../../src/screens/RapidScanScreen";

export default function RapidRoute() {
  const router = useRouter();
  // `?barcodes=a,b,c` stands in for the camera in development. A session of
  // one item exercises nothing rapid mode exists for, so this takes a list.
  const { barcodes } = useLocalSearchParams<{ barcodes?: string }>();

  // Memoised because the prop is an array: a fresh one each render would
  // retrigger the injection effect forever.
  const injected = useMemo(() => devBarcodesFrom(barcodes), [barcodes]);

  // Review is its own route rather than a mode flag on this one, so the back
  // gesture and the browser back button both behave.
  return (
    <SafeScreen edges={[]}>
      <RapidScanScreen
        onReview={() => router.push("/add/review")}
        onCancel={() => goBackOr(router, "/add")}
        injectedBarcodes={injected}
      />
    </SafeScreen>
  );
}
