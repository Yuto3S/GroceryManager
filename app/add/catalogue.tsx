import { useRouter } from "expo-router";
import CatalogueAddScreen from "../../src/screens/CatalogueAddScreen";

export default function CatalogueRoute() {
  const router = useRouter();
  return (
    <CatalogueAddScreen
      onDone={() => router.replace("/")}
      onCancel={() => router.back()}
      onScan={() => router.replace("/add/scan")}
      onType={() => router.replace("/add/manual")}
    />
  );
}
