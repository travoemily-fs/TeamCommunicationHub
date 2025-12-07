import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConnectionStatus } from "@/src/components/ConnectionStatus";


export default function RootLayout() {
  return (
    <SafeAreaView style={{ flex: 1}}>
      <ConnectionStatus />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}
