import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native'; 
import { useSocket } from '../hooks/useSocket';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, connectionError, emit, lastPong } = useSocket();

  const testConnection = () => {
    emit('ping', {
      clientTimestamp: new Date().toISOString(),
      platform: Platform.OS,
    });
  };

  return (
    <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-semibold text-gray-800 dark:text-white">
          Real-Time Status
        </Text>
        <View className={`w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />
      </View>
      
      <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        {isConnected ? 'Connected to server' : 'Disconnected'}
      </Text>
      
      {connectionError && (
        <Text className="text-sm text-red-500 mb-2">
          Error: {connectionError}
        </Text>
      )}
      
      {lastPong && (
        <Text className="text-xs text-gray-500 dark:text-gray-500 mb-2">
          Last ping: {lastPong.toLocaleTimeString()}
        </Text>
      )}
      
      <TouchableOpacity
        className="bg-blue-500 rounded-lg py-2 px-4 active:bg-blue-600"
        onPress={testConnection}
        disabled={!isConnected}
      >
        <Text className="text-white text-center font-medium">
          Test Connection
        </Text>
      </TouchableOpacity>
    </View>
  );
};