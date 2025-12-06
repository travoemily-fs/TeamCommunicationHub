import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConnectionStatus } from "@/src/components/ConnectionStatus";
import { OfflineIndicator } from "@/src/components/OfflineIndicator";

export default function RootLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OfflineIndicator />
      <ConnectionStatus />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}
