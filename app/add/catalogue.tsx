import { useRouter } from "expo-router";
import SafeScreen from "../../src/components/SafeScreen";
import { goBackOr } from "../../src/lib/navigation";
import CatalogueAddScreen from "../../src/screens/CatalogueAddScreen";

export default function CatalogueRoute() {
  const router = useRouter();
  return (
    <SafeScreen>
      <CatalogueAddScreen
        onDone={() => router.replace("/")}
        onCancel={() => goBackOr(router, "/add")}
        onScan={() => router.replace("/add/scan")}
        onType={() => router.replace("/add/manual")}
      />
    </SafeScreen>
  );
}
