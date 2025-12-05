import React from 'react';
import { View, Text } from 'react-native';

interface TaskSyncStatusProps {
  syncStatus: 'synced' | 'pending' | 'failed' | 'conflict';
  size?: 'small' | 'normal';
}
export const TaskSyncStatus: React.FC<TaskSyncStatusProps> = ({ 
  syncStatus, 
  size = 'normal' 
}) => {
  const getStatusInfo = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: '✅',
          text: 'Synced',
          color: 'text-green-600 dark:text-green-400',
        };
      case 'pending':
        return {
          icon: '⏳',
          text: 'Syncing...',
          color: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'failed':
        return {
          icon: '❌',
          text: 'Sync failed',
          color: 'text-red-600 dark:text-red-400',
        };
      case 'conflict':
        return {
          icon: '⚠️',
          text: 'Conflict',
          color: 'text-orange-600 dark:text-orange-400',
        };
      default:
        return {
          icon: '❓',
          text: 'Unknown',
          color: 'text-gray-600 dark:text-gray-400',
        };
    }
  };
  const info = getStatusInfo();
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';
  return (
    <View className="flex-row items-center">
      <Text className={`${textSize} mr-1`}>{info.icon}</Text>
      <Text className={`${textSize} ${info.color}`}>{info.text}</Text>
    </View>
  );
};