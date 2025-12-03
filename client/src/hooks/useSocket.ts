import { useEffect, useState, useCallback, useRef } from "react";
import { socketService } from "../services/socketService";

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

    socketService.connect();

    // Set up event listeners
    socketService.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);
    });
    socketService.on("disconnect", () => {
      setIsConnected(false);
    });
    socketService.on("connect_error", (error: any) => {
      setConnectionError(error.message);
      setIsConnected(false);
    });
    socketService.on("connection_confirmed", (data: any) => {
      console.log("Connection confirmed:", data);
    });
    socketService.on("pong", (data: any) => {
      setLastPong(new Date(data.serverTimestamp));
    });

    // Cleanup on unmount
    return () => {
      // removed socketService.disconnect() to keep socket going across multiple screens & listeners to prevent duplicates
      socketService.off("connect");
      socketService.off("disconnect");
      socketService.off("connect_error");
      socketService.off("connection_confirmed");
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
