import { useRouter } from "expo-router";
import ManualAddScreen from "../../src/screens/ManualAddScreen";

export default function ManualRoute() {
  const router = useRouter();
  return (
    <ManualAddScreen
      onDone={() => router.replace("/")}
      onCancel={() => router.back()}
    />
  );
}
