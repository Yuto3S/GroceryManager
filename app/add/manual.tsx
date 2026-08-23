import { useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { goBackOr } from "../../src/lib/navigation";
import ManualAddScreen from "../../src/screens/ManualAddScreen";

export default function ManualRoute() {
  const router = useRouter();
  return (
    <SafeScreen>
      <ManualAddScreen
        onDone={() => router.replace("/")}
        onCancel={() => goBackOr(router, "/add")}
      />
    </SafeScreen>
  );
}
