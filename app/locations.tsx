import { useRouter } from "expo-router";
import SafeScreen from "../src/components/SafeScreen";
import { goBackOr } from "../src/lib/navigation";
import LocationsScreen from "../src/screens/LocationsScreen";

export default function LocationsRoute() {
  const router = useRouter();
  return (
    <SafeScreen>
      <LocationsScreen onDone={() => goBackOr(router, "/")} />
    </SafeScreen>
  );
}
