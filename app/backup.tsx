import { useRouter } from "expo-router";
import SafeScreen from "../src/components/SafeScreen";
import { goBackOr } from "../src/lib/navigation";
import BackupScreen from "../src/screens/BackupScreen";

export default function BackupRoute() {
  const router = useRouter();
  return (
    <SafeScreen>
      <BackupScreen onDone={() => goBackOr(router, "/")} />
    </SafeScreen>
  );
}
