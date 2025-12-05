// client/src/services/collaborativeService.ts
import { socketService } from "./socketService";
import { connectionManager, ConnectionState } from "./connectionManager";
import { chatDatabaseService } from "./chatDatabase";

export interface CollaborativeOperation {
  type: "SET_VALUE" | "UPDATE_TASK" | "ADD_TASK" | "DELETE_TASK";
  path?: string;
  value?: any;
  taskId?: string;
  task?: any;
  updates?: any;
  userId: string;
  clientId?: string;
}

export interface Participant {
  userId: string;
  userName: string;
  isActive: boolean;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  lastActivity: string;
}

export interface EditLock {
  field: string;
  userId: string;
  userName: string;
}

export interface CollaborativeState {
  tasks: { [taskId: string]: any & { syncStatus?: "synced" | "pending" | "failed" | "conflict" } };
  [key: string]: any;
}

class CollaborativeService {
  private currentUserId: string | null = null;
  private currentRoomId: string | null = null;
  private localState: CollaborativeState = { tasks: {} };
  private pendingOperations: Map<string, CollaborativeOperation> = new Map();

  // Event listeners
  private stateListeners: ((state: CollaborativeState) => void)[] = [];
  private participantListeners: ((participants: Participant[]) => void)[] = [];
  private lockListeners: ((locks: EditLock[]) => void)[] = [];
  private presenceListeners: ((userId: string, presence: any) => void)[] = [];

  async initialize(userId: string, roomId: string): Promise<void> {
    this.currentUserId = userId;
    this.currentRoomId = roomId;

    await chatDatabaseService.initializeDatabase();
    this.setupSocketListeners();
    this.setupConnectionListeners();

    await connectionManager.connect();

    if (connectionManager.isConnected()) {
      this.joinRoom();
    }
  }

  private setupConnectionListeners(): void {
    connectionManager.onConnectionChange((info) => {
      if (info.state === ConnectionState.CONNECTED && this.currentRoomId) {
        this.joinRoom();
      }
    });
  }

  private setupSocketListeners(): void {
    socketService.on("collaborative_state_sync", (data: any) => {
      this.localState = { ...data.sharedState };
      this.notifyStateListeners();
      this.notifyParticipantListeners(data.participants || []);
      this.notifyLockListeners(Object.values(data.activeEditors || {}));
    });

    socketService.on("operation_applied", (data: { operation: CollaborativeOperation; sharedState: CollaborativeState }) => {
      if (data.operation.userId !== this.currentUserId) {
        this.localState = { ...data.sharedState };
        this.notifyStateListeners();
      }
    });

    socketService.on("participants_updated", (data: { participants: Participant[] }) => {
      this.notifyParticipantListeners(data.participants);
    });

    socketService.on("field_locked", (data: EditLock) => {
      this.notifyLockListeners([data]);
    });

    socketService.on("field_unlocked", () => {
      this.notifyLockListeners([]);
    });

    socketService.on("presence_updated", (data: { userId: string; presenceData: any }) => {
      this.notifyPresenceListeners(data.userId, data.presenceData);
    });
  }

  private joinRoom(): void {
    socketService.emit("join_collaborative_room", {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      userName: "User " + this.currentUserId,
    });
  }

  async updateTask(taskId: string, updates: any): Promise<void> {
    const operation: CollaborativeOperation = {
      type: "UPDATE_TASK",
      taskId,
      updates,
      userId: this.currentUserId!,
      clientId: this.generateClientId(),
    };

    this.applyOperationLocally(operation);
    if (this.localState.tasks[taskId]) {
      this.localState.tasks[taskId].syncStatus = "pending";
      this.notifyStateListeners();
    }

    if (connectionManager.isConnected()) {
      socketService.emit("collaborative_operation", { roomId: this.currentRoomId, operation });
    } else {
      connectionManager.queueOperation({
        type: "collaborative_operation",
        data: { roomId: this.currentRoomId, operation },
      });
    }
  }

  async addTask(taskId: string, task: any): Promise<void> {
    const operation: CollaborativeOperation = {
      type: "ADD_TASK",
      taskId,
      task: { ...task, syncStatus: "pending" },
      userId: this.currentUserId!,
      clientId: this.generateClientId(),
    };

    this.applyOperationLocally(operation);
    this.notifyStateListeners();

    if (connectionManager.isConnected()) {
      socketService.emit("collaborative_operation", { roomId: this.currentRoomId, operation });
    } else {
      connectionManager.queueOperation({
        type: "collaborative_operation",
        data: { roomId: this.currentRoomId, operation },
      });
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const operation: CollaborativeOperation = {
      type: "DELETE_TASK",
      taskId,
      userId: this.currentUserId!,
      clientId: this.generateClientId(),
    };

    if (this.localState.tasks[taskId]) {
      this.localState.tasks[taskId].deleted = true;
      this.localState.tasks[taskId].syncStatus = "pending";
      this.notifyStateListeners();
    }

    if (connectionManager.isConnected()) {
      socketService.emit("collaborative_operation", { roomId: this.currentRoomId, operation });
    } else {
      connectionManager.queueOperation({
        type: "collaborative_operation",
        data: { roomId: this.currentRoomId, operation },
      });
    }
  }

  async requestEditLock(field: string): Promise<boolean> {
    return new Promise((resolve) => {
      socketService.emit("request_edit_lock", { roomId: this.currentRoomId, field, userId: this.currentUserId });
      const handler = (data: { success: boolean; field: string }) => {
        if (data.field === field) {
          socketService.off("edit_lock_response", handler);
          resolve(data.success);
        }
      };
      socketService.on("edit_lock_response", handler);
    });
  }

  async releaseEditLock(field: string): Promise<void> {
    socketService.emit("release_edit_lock", { roomId: this.currentRoomId, field, userId: this.currentUserId });
  }

  updatePresence(presenceData: any): void {
    socketService.emit("update_presence", { roomId: this.currentRoomId, userId: this.currentUserId, presenceData });
  }

  setUserActivity(isActive: boolean): void {
    socketService.emit("user_activity_change", { roomId: this.currentRoomId, userId: this.currentUserId, isActive });
  }

  private applyOperationLocally(operation: CollaborativeOperation): void {
    switch (operation.type) {
      case "UPDATE_TASK":
        if (!this.localState.tasks) this.localState.tasks = {};
        this.localState.tasks[operation.taskId!] = {
          ...this.localState.tasks[operation.taskId!],
          ...operation.updates,
          lastModifiedBy: operation.userId,
          lastModifiedAt: new Date().toISOString(),
        };
        break;
      case "ADD_TASK":
        if (!this.localState.tasks) this.localState.tasks = {};
        this.localState.tasks[operation.taskId!] = operation.task;
        break;
      case "DELETE_TASK":
        if (this.localState.tasks) delete this.localState.tasks[operation.taskId!];
        break;
    }
  }

  private generateClientId(): string {
    return `${this.currentUserId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event listeners
  onStateChange(cb: (state: CollaborativeState) => void): () => void {
    this.stateListeners.push(cb);
    return () => { this.stateListeners = this.stateListeners.filter(c => c !== cb); };
  }
  onParticipantsChange(cb: (p: Participant[]) => void): () => void {
    this.participantListeners.push(cb);
    return () => { this.participantListeners = this.participantListeners.filter(c => c !== cb); };
  }
  onLocksChange(cb: (l: EditLock[]) => void): () => void {
    this.lockListeners.push(cb);
    return () => { this.lockListeners = this.lockListeners.filter(c => c !== cb); };
  }
  onPresenceChange(cb: (id: string, p: any) => void): () => void {
    this.presenceListeners.push(cb);
    return () => { this.presenceListeners = this.presenceListeners.filter(c => c !== cb); };
  }

  private notifyStateListeners() { this.stateListeners.forEach(cb => cb(this.localState)); }
  private notifyParticipantListeners(p: Participant[]) { this.participantListeners.forEach(cb => cb(p)); }
  private notifyLockListeners(l: EditLock[]) { this.lockListeners.forEach(cb => cb(l)); }
  private notifyPresenceListeners(id: string, p: any) { this.presenceListeners.forEach(cb => cb(id, p)); }

  getState(): CollaborativeState { return this.localState; }
}

export const collaborativeService = new CollaborativeService();