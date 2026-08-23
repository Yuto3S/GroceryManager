import { useRouter } from "expo-router";
import ScanReviewScreen from "../../src/screens/ScanReviewScreen";

export default function ReviewRoute() {
  const router = useRouter();
  return (
    <ScanReviewScreen
      onDone={() => router.replace("/")}
      onBack={() => router.back()}
    />
  );
}
