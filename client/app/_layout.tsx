import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConnectionStatus } from "@/src/components/ConnectionStatus";
import { useEffect } from "react";
import { chatDatabaseService } from "@/src/services/chatDatabase";

export default function RootLayout() {
  useEffect(() => {
    chatDatabaseService
      .initializeDatabase()
      .then(() => console.log("DB ready"))
      .catch((err) => console.error("DB init error:", err));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ConnectionStatus />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}
