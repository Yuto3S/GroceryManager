import { useRouter } from "expo-router";
import LocationsScreen from "../src/screens/LocationsScreen";

export default function LocationsRoute() {
  const router = useRouter();
  return <LocationsScreen onDone={() => router.back()} />;
}
