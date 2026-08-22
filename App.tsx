// App entry: a simple two-tab layout (Scan / List) with no extra navigation
// library, wrapped in the grocery state provider.

import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Platform,
  StatusBar as RNStatusBar,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ListScreen from "./src/screens/ListScreen";
import ScanScreen from "./src/screens/ScanScreen";
import { GroceryProvider, useGrocery } from "./src/state/GroceryStore";
import { colors } from "./src/theme";

type TabKey = "scan" | "list";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "scan", label: "Scan", icon: "▣" },
  { key: "list", label: "List", icon: "☰" },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

function TabBar({ active, onChange }: TabBarProps) {
  const { items } = useGrocery();
  const toBuyCount = items.filter((i) => !i.bought).length;

  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={styles.tab}
            onPress={() => onChange(t.key)}
          >
            <Text style={[styles.tabIcon, isActive && styles.tabActive]}>
              {t.icon}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.tabActive]}>
              {t.label}
              {t.key === "list" && toBuyCount > 0 ? ` (${toBuyCount})` : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabKey>("scan");
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Grocery Scanner</Text>
      </View>
      <View style={styles.screen}>
        {tab === "scan" ? <ScanScreen /> : <ListScreen />}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GroceryProvider>
      <Shell />
    </GroceryProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
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
