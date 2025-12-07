import React, { useState, useEffect } from "react";
import { View, Text, Animated } from "react-native";
import {
  connectionManager,
  ConnectionState,
} from "@/src/services/connectionManager";

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-20));

  useEffect(() => {
    const unsubscribe = connectionManager.onConnectionChange((info) => {
      const shouldShow =
        info.state === ConnectionState.DISCONNECTED ||
        info.state === ConnectionState.FAILED ||
        (!info.isOnline && info.state !== ConnectionState.CONNECTING);

      if (shouldShow !== isOffline) {
        setIsOffline(shouldShow);

        Animated.timing(slideAnim, {
          toValue: shouldShow ? 0 : -20,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    });

    return unsubscribe;
  }, [isOffline, slideAnim]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
      }}>
      <View className="bg-red-500/20 rounded-md pt-5">
        <Text className="text-red-600 text-sm font-medium">
          📱 No internet connection
        </Text>
      </View>
    </Animated.View>
  );
};
