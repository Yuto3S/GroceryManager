// The tab group: the app header, the two tabs, and the tab bar underneath.
//
// This uses Expo Router's *headless* tabs (`expo-router/ui`) rather than the
// batteries-included `<Tabs>` navigator, so the tab bar is one we write and can
// hang a count off.
//
// `(tabs)` is a route *group*: the parentheses keep it out of the URL, so these
// screens live at `/` and `/add` rather than `/tabs/...`.

import { usePathname } from "expo-router";
import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import {
  Platform,
  StatusBar as RNStatusBar,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { isVisible } from "../../src/lib/pantry";
import { usePantry } from "../../src/state/PantryStore";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const { entries } = usePantry();
  // Replaces the old still-to-buy badge. A count of what is actually in the
  // pantry is the number that means something now — and it is the one that
  // makes bootstrapping feel like it is going somewhere.
  const inStock = Object.values(entries).filter(isVisible).length;

  // Which tab is active is derived from the URL rather than held in state.
  // That is the whole point of routing: the address bar on web and the
  // navigation state on device are the same source of truth.
  const pathname = usePathname();
  const onPantry = pathname === "/";
  const onAdd = pathname === "/add";

  return (
    <SafeAreaView style={styles.root}>
      <Tabs style={styles.tabs}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pantry</Text>
        </View>

        <TabSlot style={styles.screen} />

        <TabList style={styles.tabBar}>
          <TabTrigger
            name="pantry"
            href="/"
            style={styles.tab}
            testID="tab-pantry"
          >
            <Text style={[styles.tabIcon, onPantry && styles.tabActive]}>
              ☰
            </Text>
            <Text style={[styles.tabLabel, onPantry && styles.tabActive]}>
              {inStock > 0 ? `Pantry (${inStock})` : "Pantry"}
            </Text>
          </TabTrigger>

          <TabTrigger
            name="add"
            href="/add"
            style={styles.tab}
            testID="tab-add"
          >
            <Text style={[styles.tabIcon, onAdd && styles.tabActive]}>＋</Text>
            <Text style={[styles.tabLabel, onAdd && styles.tabActive]}>
              Add
            </Text>
          </TabTrigger>
        </TabList>
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
  tabs: { flex: 1 },
  header: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  tabIcon: { fontSize: 20, color: colors.subtle },
  tabLabel: { fontSize: 12, color: colors.subtle, fontWeight: "600" },
  tabActive: { color: colors.primary },
});
