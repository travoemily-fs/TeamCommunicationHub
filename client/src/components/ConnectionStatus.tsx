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
    <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, margin: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontWeight: '600', fontSize: 16, color: '#1f2937' }}>Real-Time Status</Text>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isConnected ? '#10b981' : '#ef4444' }} />
      </View>

      <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
        {isConnected ? 'Connected to server' : 'Disconnected'}
      </Text>

      {connectionError && (
        <Text style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}>
          Error: {connectionError}
        </Text>
      )}

      {lastPong && (
        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          Last ping: {lastPong.toLocaleTimeString()}
        </Text>
      )}

      <TouchableOpacity
        onPress={testConnection}
        disabled={!isConnected}
        style={{
          backgroundColor: '#3b82f6',
          padding: 12,
          borderRadius: 8,
          opacity: isConnected ? 1 : 0.5,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
          Test Connection
        </Text>
      </TouchableOpacity>
    </View>
  );
};