import { useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { goBackOr } from "../../src/lib/navigation";
import ScanReviewScreen from "../../src/screens/ScanReviewScreen";

export default function ReviewRoute() {
  const router = useRouter();
  return (
    <SafeScreen>
      <ScanReviewScreen
        onDone={() => router.replace("/")}
        onBack={() => goBackOr(router, "/add")}
      />
    </SafeScreen>
  );
}
