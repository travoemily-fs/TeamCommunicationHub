import { useEffect, useState, useCallback, useRef } from "react";
import { socketService } from "../services/socketService";
import { connectionManager } from "@/src/services/connectionManager";

export interface UseSocketReturn {
  isConnected: boolean;
  connectionError: string | null;
  emit: (event: string, data?: any) => void;
  lastPong: Date | null;
}

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastPong, setLastPong] = useState<Date | null>(null);

  // prevents double connection
  const hasSetup = useRef(false);

  useEffect(() => {
    // Connect when hook mounts
    if (hasSetup.current) return;
    hasSetup.current = true;

    connectionManager.connect();

    const unsubscribe = connectionManager.onConnectionChange((info) => {
      if (info.state === "CONNECTED") {
        setIsConnected(true);
        setConnectionError(null);
      } else if (info.state === "FAILED") {
        setIsConnected(false);
        setConnectionError(info.disconnectReason ?? "Connection failed");
      } else if (info.state === "DISCONNECTED") {
        setIsConnected(false);
      }
    });

    // Set up event listeners
    socketService.on("pong", (data: any) => {
      setLastPong(new Date(data.serverTimestamp));
    });

    // Cleanup on unmount
    return () => {
      // removed socketService.disconnect() to keep socket going across multiple screens & listeners to prevent duplicates
      unsubscribe();
      socketService.off("pong");
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketService.emit(event, data);
  }, []);

  return {
    isConnected,
    connectionError,
    emit,
    lastPong,
  };
};
