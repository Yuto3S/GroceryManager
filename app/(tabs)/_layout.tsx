// The tab group: the app header, the two tabs, and the tab bar underneath.
//
// This uses Expo Router's *headless* tabs (`expo-router/ui`) rather than the
// batteries-included `<Tabs>` navigator. The headless version renders the tab
// bar we write ourselves, so the bar App.tsx used to draw — glyph, label, and
// the "(n)" still-to-buy count — survives the migration pixel for pixel. The
// standard navigator would have replaced it with React Navigation's own bar.
//
// `(tabs)` is a route *group*: the parentheses keep it out of the URL, so these
// screens live at `/` and `/list` rather than `/tabs/...`.

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
import { useGrocery } from "../../src/state/GroceryStore";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const { items } = useGrocery();
  const toBuyCount = items.filter((i) => !i.bought).length;

  // Which tab is active is derived from the URL rather than held in state.
  // That is the whole point of routing: the address bar on web and the
  // navigation state on device are the same source of truth.
  const pathname = usePathname();
  const onScan = pathname === "/";
  const onList = pathname === "/list";

  return (
    <SafeAreaView style={styles.root}>
      <Tabs style={styles.tabs}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Grocery Scanner</Text>
        </View>

        <TabSlot style={styles.screen} />

        <TabList style={styles.tabBar}>
          <TabTrigger name="scan" href="/" style={styles.tab}>
            <Text style={[styles.tabIcon, onScan && styles.tabActive]}>▣</Text>
            <Text style={[styles.tabLabel, onScan && styles.tabActive]}>
              Scan
            </Text>
          </TabTrigger>

          <TabTrigger name="list" href="/list" style={styles.tab}>
            <Text style={[styles.tabIcon, onList && styles.tabActive]}>☰</Text>
            <Text style={[styles.tabLabel, onList && styles.tabActive]}>
              {toBuyCount > 0 ? `List (${toBuyCount})` : "List"}
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
