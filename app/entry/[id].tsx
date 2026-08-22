import { useLocalSearchParams, useRouter } from "expo-router";
import EntryDetailScreen from "../../src/screens/EntryDetailScreen";

export default function EntryRoute() {
  // Route params arrive as string | string[] — a repeated segment is possible
  // in principle, so take the first rather than asserting the shape.
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  return <EntryDetailScreen id={id ?? ""} onDone={() => router.back()} />;
}
