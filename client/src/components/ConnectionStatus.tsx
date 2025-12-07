import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import {
  connectionManager,
  ConnectionState,
  ConnectionInfo,
  QueuedOperation,
} from "@/src/services/connectionManager";
import { OfflineIndicator } from "./OfflineIndicator";

export const ConnectionStatus: React.FC = () => {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(
    connectionManager.getConnectionInfo()
  );
  const [queuedOps, setQueuedOps] = useState<QueuedOperation[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  useEffect(() => {
    const unsubscribeConnection = connectionManager.onConnectionChange(
      (info) => {
        setConnectionInfo(info);

        if (info.state === ConnectionState.CONNECTED) {
          setHasConnectedOnce(true);
        }
      }
    );

    const unsubscribeQueue = connectionManager.onQueueChange(setQueuedOps);
    return () => {
      unsubscribeConnection();
      unsubscribeQueue();
    };
  }, []);

  useEffect(() => {
    // adding logic check to avoid ui flashing when disconnected
    const state = connectionInfo.state;

    if (state === ConnectionState.CONNECTING && !hasConnectedOnce) {
      return;
    }

    if (
      state === ConnectionState.DISCONNECTED ||
      state === ConnectionState.FAILED
    ) {
      fadeAnim.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [connectionInfo.state, fadeAnim, hasConnectedOnce]);

  const getStatusColor = () => {
    switch (connectionInfo.state) {
      case ConnectionState.CONNECTED:
        return "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      case ConnectionState.DISCONNECTED:
      case ConnectionState.FAILED:
        return "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  const getStatusIcon = () => {
    switch (connectionInfo.state) {
      case ConnectionState.CONNECTED:
        return "🛜  Live";
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return "📶  Connecting";
      case ConnectionState.DISCONNECTED:
      case ConnectionState.FAILED:
        return "📵  Offline";
      default:
        return "⚠️  Unknown";
    }
  };

  const handleRetry = () => connectionManager.connect();

  const formatLatency = (latency?: number) =>
    !latency
      ? "Unknown"
      : latency < 100
      ? `${latency}ms (Excellent)`
      : latency < 300
      ? `${latency}ms (Good)`
      : `${latency}ms (Fair)`;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        className={`p-5 ${getStatusColor()}`}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-gray-800 dark:text-gray-400 font-medium mb-3 mt-4">
              {getStatusIcon()}
            </Text>
          </View>

          {(connectionInfo.state === ConnectionState.DISCONNECTED ||
            connectionInfo.state === ConnectionState.FAILED) && (
            <Text className="flex-row items-center pt-5">
              <OfflineIndicator />
            </Text>
          )}

          {(connectionInfo.state === ConnectionState.FAILED ||
            connectionInfo.state === ConnectionState.DISCONNECTED) && (
            <TouchableOpacity
              className="bg-blue-500 rounded px-5 rounded-lg py-3 ml-2"
              onPress={(e) => {
                e.stopPropagation?.();
                handleRetry();
              }}>
              <Text className="text-white text-sm font-medium">
                {hasConnectedOnce ? "Retry" : "Connect"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isExpanded && (
          <View className="t-5 border-t border-gray-200 dark:border-gray-300 space-y-1">
            <View className="flex-row justify-around">
              <Text className="text-sm text-gray-800 dark:text-gray-400 pt-3">
                Network: 
              </Text>
              <Text className="text-sm text-gray-800 dark:text-gray-400 pt-3">
                {connectionInfo.isOnline ? " Online" : " Offline"}
              </Text>
            </View>

            {connectionInfo.latency && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  Latency:
                </Text>
                <Text className="text-sm text-gray-800 dark:text-gray-400">
                  {formatLatency(connectionInfo.latency)}
                </Text>
              </View>
            )}

            {connectionInfo.lastConnected && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  Last Connected:
                </Text>
                <Text className="text-sm text-gray-800 dark:text-gray-400">
                  {connectionInfo.lastConnected.toLocaleTimeString()}
                </Text>
              </View>
            )}

            {queuedOps.length > 0 && (
              <View className="mt-2">
                <Text className="text-sm font-medium text-gray-800 dark:text-white mb-1">
                  Pending Operations:
                </Text>
                {queuedOps.slice(0, 3).map((op) => (
                  <Text
                    key={op.id}
                    className="text-xs text-gray-600 dark:text-gray-400">
                    • {op.operation.type} (retry {op.retryCount})
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};
