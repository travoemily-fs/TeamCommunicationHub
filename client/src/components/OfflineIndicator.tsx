import React, { useState, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { connectionManager, ConnectionState } from '@/src/services/connectionManager'

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));
  useEffect(() => {
    const unsubscribe = connectionManager.onConnectionChange((info) => {
      const shouldShow = info.state === ConnectionState.DISCONNECTED || 
                        info.state === ConnectionState.FAILED ||
                        !info.isOnline;
      
      if (shouldShow !== isOffline) {
        setIsOffline(shouldShow);
        
        Animated.timing(slideAnim, {
          toValue: shouldShow ? 0 : -100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
    return unsubscribe;
  }, [isOffline, slideAnim]);
  return (
    <Animated.View
      className="absolute top-0 left-0 right-0 bg-red-500 z-50"
      style={{
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View className="px-4 py-2 flex-row items-center justify-center">
        <Text className="text-white text-sm font-medium">
          📱 No internet connection • Changes will sync when online
        </Text>
      </View>
    </Animated.View>
  );
};