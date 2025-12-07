import "../styles/global.css";
import { View, Text, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-4xl font-bold text-gray-900 mb-4">
        Team Communication Hub
      </Text>

      <Text className="text-md text-gray-600 text-center mb-8">
        Connect for online features or proceed with limited offline features.
      </Text>



      <View className="w-sm space-y-4">
        <Link href="/chat" asChild>
          <TouchableOpacity className="w-full bg-blue-500 rounded-lg p-5 items-center">
            <Text className="text-white font-semibold text-base">
              Open Chat
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/collaborative" asChild>
          <TouchableOpacity className="w-sm bg-indigo-500 rounded-lg p-5 items-center">
            <Text className="text-white font-semibold text-base">
              Collaborative Tasks
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}
