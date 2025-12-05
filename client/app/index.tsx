import "../styles/global.css";
import { View, Text, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-4xl font-bold text-gray-900 mb-4">
        Team Communication Hub
      </Text>

      <Text className="text-lg text-gray-600 text-center mb-8">
        Real-time connection is active in the status bar above
      </Text>

      <Text className="text-sm text-gray-500 mb-8 text-center">
        Ready for channels, messages, and team presence
      </Text>

      <View className="w-full space-y-4">
        <Link href="/chat" asChild>
          <TouchableOpacity className="w-full bg-blue-500 rounded-lg py-3 items-center">
            <Text className="text-white font-semibold text-base">
              Open Chat
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/collaborative" asChild>
          <TouchableOpacity className="w-full bg-indigo-500 rounded-lg py-3 items-center">
            <Text className="text-white font-semibold text-base">
              Collaborative Tasks
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}
