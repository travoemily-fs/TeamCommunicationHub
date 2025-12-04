import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-4xl font-bold text-gray-900 mb-4">
        Team Communication Hub
      </Text>
      <Text className="text-lg text-gray-600 text-center mb-8">
        Real-time connection is active in the status bar above
      </Text>
      <Text className="text-sm text-gray-500">
        Ready for channels, messages, and team presence
      </Text>
    </View>
  );
}