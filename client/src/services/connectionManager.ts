import { socketService } from "@/src/services/socketService";

export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  FAILED = "FAILED",
}

export interface ConnectionInfo {
  state: ConnectionState;
  lastConnected?: Date;
  disconnectReason?: string;
  reconnectAttempt: number;
  isOnline: boolean;
  latency?: number;
}

export interface QueuedOperation {
  id: string;
  operation: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

class ConnectionManager {
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeouts: number[] = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private operationQueue: QueuedOperation[] = [];
  private isManualDisconnect: boolean = false;
  private lastHeartbeat: Date | null = null;
  private latency: number = 0;
  // prevent it trying to reconnect based off of the browser
  private lastConnectAttempt: number = 0;

  // Event listeners
  private connectionListeners: ((info: ConnectionInfo) => void)[] = [];
  private queueListeners: ((operations: QueuedOperation[]) => void)[] = [];
  constructor() {
    this.setupNetworkListeners();
    this.setupSocketListeners();
  }

  private setupNetworkListeners(): void {
    if (
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("online", this.handleNetworkOnline.bind(this));
      window.addEventListener("offline", this.handleNetworkOffline.bind(this));
    }
  }

  private setupSocketListeners(): void {
    socketService.on("connect", this.handleSocketConnect.bind(this));
    socketService.on("disconnect", this.handleSocketDisconnect.bind(this));
    socketService.on("connect_error", this.handleSocketError.bind(this));
    socketService.on("reconnect", this.handleSocketReconnect.bind(this));
    socketService.on(
      "reconnect_error",
      this.handleSocketReconnectError.bind(this)
    );
    socketService.on("pong", this.handleHeartbeatResponse.bind(this));
  }

  // altered block to prevent the rapid-fire browser reconnect attempts
  async connect(): Promise<void> {
    const now = Date.now();
    if (now - this.lastConnectAttempt < 5000) {
      console.log("Skipping connect() — throttled to prevent spam");
      return;
    }

    this.lastConnectAttempt = now;

    if (this.connectionState === ConnectionState.CONNECTED) {
      return;
    }

    this.isManualDisconnect = false;
    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      socketService.connect();
    } catch (error) {
      console.error("Connection error:", error);
      this.setConnectionState(ConnectionState.FAILED);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();

    socketService.disconnect();
    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  private handleSocketConnect(): void {
    console.log("Socket connected successfully");
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.setConnectionState(ConnectionState.CONNECTED);
    this.startHeartbeat();
    this.processQueuedOperations();
  }

  private handleSocketDisconnect(reason: string): void {
    console.log("Socket disconnected:", reason);
    this.clearHeartbeatTimer();

    if (!this.isManualDisconnect) {
      this.setConnectionState(ConnectionState.RECONNECTING, reason);
      this.scheduleReconnect();
    }
  }

  private handleSocketError(error: any): void {
    console.error("Socket connection error:", error);

    if (this.connectionState === ConnectionState.CONNECTING) {
      this.setConnectionState(ConnectionState.FAILED, error.message);
      this.scheduleReconnect();
    }
  }

  private handleSocketReconnect(attemptNumber: number): void {
    console.log("Socket reconnected after", attemptNumber, "attempts");
    this.handleSocketConnect();
  }

  private handleSocketReconnectError(error: any): void {
    console.error("Socket reconnection error:", error);
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState(
        ConnectionState.FAILED,
        "Max reconnection attempts reached"
      );
      return;
    }

    this.scheduleReconnect();
  }

  private handleNetworkOnline(): void {
    console.log("Network came online");
    if (
      this.connectionState !== ConnectionState.CONNECTED &&
      !this.isManualDisconnect
    ) {
      this.connect();
    }
  }

  private handleNetworkOffline(): void {
    console.log("Network went offline");
    this.setConnectionState(ConnectionState.DISCONNECTED, "Network offline");
  }

  private scheduleReconnect(): void {
    if (this.isManualDisconnect || this.reconnectTimer) {
      return;
    }

    const timeoutIndex = Math.min(
      this.reconnectAttempts,
      this.reconnectTimeouts.length - 1
    );
    const delay = this.reconnectTimeouts[timeoutIndex];

    console.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManualDisconnect) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer();

    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === ConnectionState.CONNECTED) {
        const startTime = Date.now();
        this.lastHeartbeat = new Date();

        socketService.emit("ping", {
          timestamp: startTime,
          clientId: "heartbeat",
        });
      }
    }, 30000); // Heartbeat every 30 seconds
  }

  private handleHeartbeatResponse(data: any): void {
    if (data.clientId === "heartbeat") {
      const now = Date.now();
      this.latency = now - data.timestamp;
      this.notifyConnectionListeners();
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Operation queueing for offline scenarios
  queueOperation(operation: any, maxRetries: number = 3): string {
    const queuedOp: QueuedOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries,
    };
    this.operationQueue.push(queuedOp);
    this.notifyQueueListeners();
    // Try to process immediately if connected
    if (this.connectionState === ConnectionState.CONNECTED) {
      this.processQueuedOperations();
    }
    return queuedOp.id;
  }

  private async processQueuedOperations(): Promise<void> {
    if (
      this.connectionState !== ConnectionState.CONNECTED ||
      this.operationQueue.length === 0
    ) {
      return;
    }

    const operationsToProcess = [...this.operationQueue];
    this.operationQueue = [];
    for (const queuedOp of operationsToProcess) {
      try {
        // Emit the operation
        socketService.emit(queuedOp.operation.type, queuedOp.operation.data);
        console.log("Processed queued operation:", queuedOp.id);
      } catch (error) {
        console.error("Error processing queued operation:", error);

        // Retry if we haven't exceeded max retries
        if (queuedOp.retryCount < queuedOp.maxRetries) {
          queuedOp.retryCount++;
          this.operationQueue.push(queuedOp);
        } else {
          console.error("Max retries exceeded for operation:", queuedOp.id);
        }
      }
    }
    this.notifyQueueListeners();
  }

  removeQueuedOperation(operationId: string): void {
    this.operationQueue = this.operationQueue.filter(
      (op) => op.id !== operationId
    );
    this.notifyQueueListeners();
  }

  clearOperationQueue(): void {
    this.operationQueue = [];
    this.notifyQueueListeners();
  }

  // Connection state management
  private setConnectionState(state: ConnectionState, reason?: string): void {
    const previousState = this.connectionState;
    this.connectionState = state;

    console.log(
      `Connection state changed: ${previousState} -> ${state}`,
      reason ? `(${reason})` : ""
    );

    this.notifyConnectionListeners();
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.connectionState,
      lastConnected: this.lastHeartbeat ?? undefined, // ← FIXED: null → undefined
      disconnectReason: undefined,
      reconnectAttempt: this.reconnectAttempts,
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      latency: this.latency || undefined,
    };
  }

  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  getQueuedOperations(): QueuedOperation[] {
    return [...this.operationQueue];
  }

  // Event listener management
  onConnectionChange(callback: (info: ConnectionInfo) => void): () => void {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onQueueChange(callback: (operations: QueuedOperation[]) => void): () => void {
    this.queueListeners.push(callback);
    return () => {
      this.queueListeners = this.queueListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyConnectionListeners(): void {
    const info = this.getConnectionInfo();
    this.connectionListeners.forEach((callback) => callback(info));
  }

  private notifyQueueListeners(): void {
    this.queueListeners.forEach((callback) => callback(this.operationQueue));
  }
}
export const connectionManager = new ConnectionManager();
