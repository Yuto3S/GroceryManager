import { useLocalSearchParams, useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { goBackOr } from "../../src/lib/navigation";
import ManualAddScreen from "../../src/screens/ManualAddScreen";

export default function ManualRoute() {
  // Sent by the produce picker when its search matched nothing. A route
  // parameter is untrusted like any other, so anything that is not a plain
  // string is treated as absent rather than coerced.
  const { name } = useLocalSearchParams<{ name?: string }>();

  const router = useRouter();
  return (
    <SafeScreen>
      <ManualAddScreen
        initialName={typeof name === "string" ? name : ""}
        onDone={() => router.replace("/")}
        onCancel={() => goBackOr(router, "/add")}
      />
    </SafeScreen>
  );
}
