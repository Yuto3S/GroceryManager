import { useLocalSearchParams, useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { devBarcodeFrom } from "../../src/lib/devScan";
import { goBackOr } from "../../src/lib/navigation";
import ScanAddScreen from "../../src/screens/ScanAddScreen";

export default function ScanRoute() {
  const router = useRouter();
  // `?barcode=` stands in for the camera in development, because the iOS
  // Simulator has none. `devBarcodeFrom` returns null in a production build
  // whatever the URL says.
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();

  // Adding lands you back on the pantry so you can see what you just added;
  // cancelling goes back where you came from.
  return (
    <SafeScreen edges={[]}>
      <ScanAddScreen
        onDone={() => router.replace("/")}
        onCancel={() => goBackOr(router, "/add")}
        injectedBarcode={devBarcodeFrom(barcode)}
      />
    </SafeScreen>
  );
}
