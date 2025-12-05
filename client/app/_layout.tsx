import "../styles/global.css";
import { Stack } from "expo-router";
import { ConnectionStatus } from "@/src/components/ConnectionStatus";
import { View } from "react-native";
import { useEffect } from "react";
import { chatDatabaseService } from "@/src/services/chatDatabase";
import { OfflineIndicator } from "@/src/components/OfflineIndicator";

export default function Layout() {
  // initialize sqlite chat db when app loads
  useEffect(() => {
    chatDatabaseService.initializeDatabase();
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <OfflineIndicator />
      <ConnectionStatus />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
