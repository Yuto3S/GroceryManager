import { useRouter } from "expo-router";
import ScanAddScreen from "../../src/screens/ScanAddScreen";

export default function ScanRoute() {
  const router = useRouter();
  // Adding lands you back on the pantry so you can see what you just added;
  // cancelling goes back where you came from.
  return (
    <ScanAddScreen
      onDone={() => router.replace("/")}
      onCancel={() => router.back()}
    />
  );
}
