import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Participant } from '../services/collaborativeService';
interface PresenceIndicatorsProps {
  participants: Participant[];
  currentUserId: string;
}
export const PresenceIndicators: React.FC<PresenceIndicatorsProps> = ({
  participants,
  currentUserId,
}) => {
  const activeParticipants = participants.filter(p => 
    p.userId !== currentUserId && p.isActive
  );
  const getAvatarColor = (userId: string): string => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
    ];
    const index = parseInt(userId.slice(-1)) % colors.length;
    return colors[index];
  };
  const getInitials = (userName: string): string => {
    return userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };
  if (activeParticipants.length === 0) {
    return (
      <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
        <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
         You are working alone.
        </Text>
      </View>
    );
  }
  return (
    <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-semibold text-gray-800 dark:text-white">
          Active Collaborators
        </Text>
        <View className="flex-row items-center">
          <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {activeParticipants.length} online
          </Text>
        </View>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row space-x-3">
          {activeParticipants.map((participant) => (
            <View key={participant.userId} className="items-center">
              <View className={`w-10 h-10 rounded-full ${getAvatarColor(participant.userId)} items-center justify-center mb-1`}>
                <Text className="text-white font-semibold text-sm">
                  {getInitials(participant.userName)}
                </Text>
              </View>
              <Text className="text-xs text-gray-600 dark:text-gray-400 max-w-16 text-center" numberOfLines={1}>
                {participant.userName}
              </Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(participant.lastActivity).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};