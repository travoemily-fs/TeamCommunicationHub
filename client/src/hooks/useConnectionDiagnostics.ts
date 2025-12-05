import { useState, useEffect } from 'react';
import { connectionManager, ConnectionInfo } from '@/src/services/connectionManager'

export interface ConnectionDiagnostics {
  connectionInfo: ConnectionInfo;
  networkSpeed: 'slow' | 'medium' | 'fast' | 'unknown';
  signalStrength: 'weak' | 'medium' | 'strong' | 'unknown';
  serverReachable: boolean;
  lastSuccessfulPing?: Date;
}

export const useConnectionDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({
    connectionInfo: connectionManager.getConnectionInfo(),
    networkSpeed: 'unknown',
    signalStrength: 'unknown',
    serverReachable: false,
  });

  useEffect(() => {
    const unsubscribe = connectionManager.onConnectionChange((info) => {
      setDiagnostics(prev => ({
        ...prev,
        connectionInfo: info,
        networkSpeed: categorizeLatency(info.latency),
        serverReachable: info.state === 'CONNECTED',
        lastSuccessfulPing: info.lastConnected,
      }));
    });
    return unsubscribe;
  }, []);

  const categorizeLatency = (latency?: number): 'slow' | 'medium' | 'fast' | 'unknown' => {
    if (!latency) return 'unknown';
    if (latency < 100) return 'fast';
    if (latency < 300) return 'medium';
    return 'slow';
  };

  const runDiagnostics = async (): Promise<void> => {
    // You could implement more sophisticated diagnostics here
    // - Test different server endpoints
    // - Measure download/upload speeds
    // - Check for proxy/firewall issues
  };

  return {
    diagnostics,
    runDiagnostics,
  };
};