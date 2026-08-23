import { useRouter } from "expo-router";
import BackupScreen from "../src/screens/BackupScreen";

export default function BackupRoute() {
  const router = useRouter();
  return <BackupScreen onDone={() => router.back()} />;
}
