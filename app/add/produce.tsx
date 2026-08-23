import { useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { goBackOr } from "../../src/lib/navigation";
import ProduceAddScreen from "../../src/screens/ProduceAddScreen";

export default function ProduceRoute() {
  const router = useRouter();
  return (
    <SafeScreen>
      <ProduceAddScreen
        onDone={() => router.replace("/")}
        onCancel={() => goBackOr(router, "/add")}
        // What the user typed rides across, so a miss in the picker costs a tap
        // rather than typing it a second time.
        onType={(query) =>
          router.replace({ pathname: "/add/manual", params: { name: query } })
        }
      />
    </SafeScreen>
  );
}
