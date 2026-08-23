// Root layout. Everything the app renders lives under here, so this is where
// the store provider belongs: it sits above the router outlet, which means
// navigating between routes reads from the same store rather than remounting
// (and silently resetting) it.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PantryProvider } from "../src/state/PantryStore";
import { ScanSessionProvider } from "../src/state/ScanSessionStore";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PantryProvider>
        <ScanSessionProvider>
          <StatusBar style="dark" />
          {/*
        No header at this level — the tab group draws its own, the same one
        App.tsx used to draw. Screens pushed on top of the tabs later can opt
        back in per-route.
      */}
          <Stack screenOptions={{ headerShown: false }} />
        </ScanSessionProvider>
      </PantryProvider>
    </SafeAreaProvider>
  );
}
