import { Stack } from 'expo-router';
import { ConnectionStatus } from '../src/components/ConnectionStatus';
import { View } from 'react-native';

export default function Layout() {
  return (
    <View className="flex-1 bg-gray-50">
      <ConnectionStatus />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}