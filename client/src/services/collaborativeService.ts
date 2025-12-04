import { socketService } from "@/src/services/socketService";

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
  tasks: { [taskId: string]: any };
  [key: string]: any;
}

class CollaborativeService {
  private currentUserId: string | null = null;
  private currentRoomId: string | null = null;
  private localState: CollaborativeState = { tasks: {} };
  private pendingOperations: CollaborativeOperation[] = [];
  private isConnected: boolean = false;

  // Event listeners
  private stateListeners: ((state: CollaborativeState) => void)[] = [];
  private participantListeners: ((participants: Participant[]) => void)[] = [];
  private lockListeners: ((locks: EditLock[]) => void)[] = [];
  private presenceListeners: ((userId: string, presence: any) => void)[] = [];
  async initialize(userId: string, roomId: string): Promise<void> {
    this.currentUserId = userId;
    this.currentRoomId = roomId;

    this.setupSocketListeners();

    // Join collaborative room
    socketService.emit("join_collaborative_room", {
      roomId,
      userId,
      userName: "User " + userId, // You'd get this from user profile
    });
  }

  private setupSocketListeners(): void {
    // Handle initial state sync
    socketService.on(
      "collaborative_state_sync",
      (data: {
        roomId: string;
        sharedState: CollaborativeState;
        operationHistory: CollaborativeOperation[];
        participants: Participant[];
        activeEditors: { [field: string]: EditLock };
      }) => {
        this.localState = { ...data.sharedState };
        this.isConnected = true;

        // Apply any pending operations
        this.flushPendingOperations();

        // Notify listeners
        this.notifyStateListeners();
        this.notifyParticipantListeners(data.participants);
        this.notifyLockListeners(Object.values(data.activeEditors));
      }
    );

    // Handle operations from other users
    socketService.on(
      "operation_applied",
      (data: {
        operation: CollaborativeOperation;
        sharedState: CollaborativeState;
      }) => {
        // Don't apply operations from ourselves
        if (data.operation.userId !== this.currentUserId) {
          this.localState = { ...data.sharedState };
          this.notifyStateListeners();
        }
      }
    );

    // Handle participant updates
    socketService.on(
      "participants_updated",
      (data: { participants: Participant[] }) => {
        this.notifyParticipantListeners(data.participants);
      }
    );

    // Handle field locking
    socketService.on("field_locked", (data: EditLock) => {
      // Update UI to show field is being edited
      this.notifyLockListeners([data]);
    });
    socketService.on(
      "field_unlocked",
      (data: { field: string; userId: string }) => {
        // Update UI to show field is available
        this.notifyLockListeners([]);
      }
    );

    // Handle presence updates
    socketService.on(
      "presence_updated",
      (data: { userId: string; presenceData: any; timestamp: string }) => {
        this.notifyPresenceListeners(data.userId, data.presenceData);
      }
    );

    // Handle connection state
    socketService.on("connect", () => {
      this.isConnected = true;
      this.flushPendingOperations();
    });
    socketService.on("disconnect", () => {
      this.isConnected = false;
    });
  }

  // Public API for making collaborative changes
  async updateTask(taskId: string, updates: any): Promise<void> {
    const operation: CollaborativeOperation = {
      type: "UPDATE_TASK",
      taskId,
      updates,
      userId: this.currentUserId!,
      clientId: this.generateClientId(),
    };

    // Apply optimistically to local state
    this.applyOperationLocally(operation);

    // Send to server or queue if offline
    if (this.isConnected) {
      socketService.emit("collaborative_operation", {
        roomId: this.currentRoomId,
        operation,
      });
    } else {
      this.pendingOperations.push(operation);
    }
  }

  async addTask(taskId: string, task: any): Promise<void> {
    const operation: CollaborativeOperation = {
      type: "ADD_TASK",
      taskId,
      task: {
        ...task,
        createdBy: this.currentUserId,
        createdAt: new Date().toISOString(),
      },
      userId: this.currentUserId!,
      clientId: this.generateClientId(),
    };
    this.applyOperationLocally(operation);

    if (this.isConnected) {
      socketService.emit("collaborative_operation", {
        roomId: this.currentRoomId,
        operation,
      });
    } else {
      this.pendingOperations.push(operation);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const operation: CollaborativeOperation = {
      type: "DELETE_TASK",
      taskId,
      userId: this.currentUserId!,
      clientId: this.generateClientId(),
    };
    this.applyOperationLocally(operation);

    if (this.isConnected) {
      socketService.emit("collaborative_operation", {
        roomId: this.currentRoomId,
        operation,
      });
    } else {
      this.pendingOperations.push(operation);
    }
  }

  // Edit locking for preventing conflicts
  async requestEditLock(field: string): Promise<boolean> {
    return new Promise((resolve) => {
      socketService.emit("request_edit_lock", {
        roomId: this.currentRoomId,
        field,
        userId: this.currentUserId,
      });

      // Listen for response
      const handleResponse = (data: {
        success: boolean;
        field: string;
        currentEditor?: string;
      }) => {
        if (data.field === field) {
          socketService.off("edit_lock_response", handleResponse);
          resolve(data.success);
        }
      };
      socketService.on("edit_lock_response", handleResponse);
    });
  }

  async releaseEditLock(field: string): Promise<void> {
    socketService.emit("release_edit_lock", {
      roomId: this.currentRoomId,
      field,
      userId: this.currentUserId,
    });
  }

  // Presence management
  updatePresence(presenceData: {
    cursor?: { x: number; y: number };
    selection?: any;
  }): void {
    socketService.emit("update_presence", {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      presenceData,
    });
  }

  setUserActivity(isActive: boolean): void {
    socketService.emit("user_activity_change", {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      isActive,
    });
  }

  // State management
  getState(): CollaborativeState {
    return this.localState;
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
        if (this.localState.tasks) {
          delete this.localState.tasks[operation.taskId!];
        }
        break;
    }

    this.notifyStateListeners();
  }

  private flushPendingOperations(): void {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    operations.forEach((operation) => {
      socketService.emit("collaborative_operation", {
        roomId: this.currentRoomId,
        operation,
      });
    });
  }

  private generateClientId(): string {
    return `${this.currentUserId}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Event listener management
  onStateChange(callback: (state: CollaborativeState) => void): () => void {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter((cb) => cb !== callback);
    };
  }

  onParticipantsChange(
    callback: (participants: Participant[]) => void
  ): () => void {
    this.participantListeners.push(callback);
    return () => {
      this.participantListeners = this.participantListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onLocksChange(callback: (locks: EditLock[]) => void): () => void {
    this.lockListeners.push(callback);
    return () => {
      this.lockListeners = this.lockListeners.filter((cb) => cb !== callback);
    };
  }

  onPresenceChange(
    callback: (userId: string, presence: any) => void
  ): () => void {
    this.presenceListeners.push(callback);
    return () => {
      this.presenceListeners = this.presenceListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyStateListeners(): void {
    this.stateListeners.forEach((callback) => callback(this.localState));
  }

  private notifyParticipantListeners(participants: Participant[]): void {
    this.participantListeners.forEach((callback) => callback(participants));
  }

  private notifyLockListeners(locks: EditLock[]): void {
    this.lockListeners.forEach((callback) => callback(locks));
  }

  private notifyPresenceListeners(userId: string, presence: any): void {
    this.presenceListeners.forEach((callback) => callback(userId, presence));
  }
}

export const collaborativeService = new CollaborativeService();
