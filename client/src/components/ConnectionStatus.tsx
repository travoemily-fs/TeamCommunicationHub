import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import {
  connectionManager,
  ConnectionState,
  ConnectionInfo,
  QueuedOperation,
} from "@/src/services/connectionManager";

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
  }, [connectionInfo.state, fadeAnim]);

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

  const getStatusText = () => {
    switch (connectionInfo.state) {
      case ConnectionState.CONNECTED:
        return queuedOps.length > 0
          ? `Connected • ${queuedOps.length} pending`
          : "Connected • Live sync active";
      case ConnectionState.CONNECTING:
        return "Connecting...";
      case ConnectionState.RECONNECTING:
        return `Reconnecting... (attempt ${
          connectionInfo.reconnectAttempt + 1
        })`;
      case ConnectionState.DISCONNECTED:
        return connectionInfo.isOnline ? "Disconnected" : "Offline";
      case ConnectionState.FAILED:
        return "Connection failed";
      default:
        return "Unknown status";
    }
  };

  const getStatusIcon = () => {
    switch (connectionInfo.state) {
      case ConnectionState.CONNECTED:
        return "Live";
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return "Connecting";
      case ConnectionState.DISCONNECTED:
      case ConnectionState.FAILED:
        return "Offline";
      default:
        return "Unknown";
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
        className={`rounded-lg p-3 mb-4 border ${getStatusColor()}`}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Text className="flex-1 text-gray-800 dark:text-gray-400 font-medium">
              {getStatusIcon()} • {getStatusText()}
            </Text>
          </View>

          {(connectionInfo.state === ConnectionState.FAILED ||
            connectionInfo.state === ConnectionState.DISCONNECTED) && (
            <TouchableOpacity
              className="bg-blue-500 rounded px-3 py-1 ml-2"
              onPress={handleRetry}>
              <Text className="text-white text-sm font-medium">
                {hasConnectedOnce ? "Retry" : "Connect"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isExpanded && (
          <View className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                Network:
              </Text>
              <Text className="text-sm text-gray-800 dark:text-white">
                {connectionInfo.isOnline ? "Online" : "Offline"}
              </Text>
            </View>
            {connectionInfo.latency && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  Latency:
                </Text>
                <Text className="text-sm text-gray-800 dark:text-white">
                  {formatLatency(connectionInfo.latency)}
                </Text>
              </View>
            )}
            {connectionInfo.lastConnected && (
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  Last Connected:
                </Text>
                <Text className="text-sm text-gray-800 dark:text-white">
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
