import { useLocalSearchParams, useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { goBackOr } from "../../src/lib/navigation";
import EntryDetailScreen from "../../src/screens/EntryDetailScreen";

export default function EntryRoute() {
  // Route params arrive as string | string[] — a repeated segment is possible
  // in principle, so take the first rather than asserting the shape.
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  return (
    <SafeScreen>
      <EntryDetailScreen id={id ?? ""} onDone={() => goBackOr(router, "/")} />
    </SafeScreen>
  );
}
