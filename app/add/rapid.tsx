import { useRouter } from "expo-router";
import RapidScanScreen from "../../src/screens/RapidScanScreen";

export default function RapidRoute() {
  const router = useRouter();
  // Review is its own route rather than a mode flag on this one, so the back
  // gesture and the browser back button both behave.
  return (
    <RapidScanScreen
      onReview={() => router.push("/add/review")}
      onCancel={() => router.back()}
    />
  );
}
