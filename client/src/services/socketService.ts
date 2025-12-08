import { io, Socket } from "socket.io-client";
import { Platform } from "react-native";
import Constants from "expo-constants";

export interface SocketService {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}

class SocketServiceImpl implements SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private pendingListeners: { event: string; callback: (data: any) => void }[] =
    [];

  constructor() {
    // Configure server URL based on platform
    this.serverUrl = this.getServerUrl();
  }

  // revamped getServerUrl() function with updated function that'll support my app.json setup
  private getServerUrl(): string {
    const envUrl = process.env.EXPO_PUBLIC_SOCKET_URL;

    if (envUrl) {
      return envUrl;
    }

    if (__DEV__) {
      // localhost fallback for web
      if (Platform.OS === "web") {
        return "http://localhost:3001";
      }

      // fallback for mobile
      return Constants.expoConfig?.extra?.socketUrl!;
    }

    return "https://your-production-server.com";
  }

  connect(): void {
    if (this.socket?.connected) {
      console.log("Socket already connected");
      return;
    }

    console.log(`Connecting to socket server: ${this.serverUrl}`);

    this.socket = io(this.serverUrl, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();

    if (this.socket) {
      for (const { event, callback } of this.pendingListeners) {
        this.socket.off(event, callback);
        this.socket.on(event, callback);
      }
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
    });

    this.socket.on("reconnect_error", (error) => {
      console.error("Socket reconnection error:", error.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn("Socket not connected, cannot emit event:", event);
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      this.pendingListeners.push({ event, callback });
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (this.socket) {
      this.socket.off(event, callback as any);
    }

    if (!callback) {
      this.pendingListeners = this.pendingListeners.filter(
        (listener) => listener.event !== event
      );
    } else {
      this.pendingListeners = this.pendingListeners.filter(
        (listener) =>
          !(listener.event === event && listener.callback === callback)
      );
    }
  }
}

export const socketService = new SocketServiceImpl();
