import { useState, useEffect, useCallback } from "react";
import {
  collaborativeService,
  CollaborativeState,
  Participant,
  EditLock,
} from "@/src/services/collaborativeService";
import { socketService } from "@/src/services/socketService";

export interface UseCollaborativeReturn {
  sharedState: CollaborativeState;
  participants: Participant[];
  editLocks: EditLock[];
  isConnected: boolean;
  updateTask: (taskId: string, updates: any) => Promise<void>;
  addTask: (taskId: string, task: any) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  requestEditLock: (field: string) => Promise<boolean>;
  releaseEditLock: (field: string) => Promise<void>;
  updatePresence: (presence: any) => void;
  setUserActivity: (isActive: boolean) => void;
}

export const useCollaborative = (
  userId: string,
  roomId: string
): UseCollaborativeReturn => {
  const [sharedState, setSharedState] = useState<CollaborativeState>({
    tasks: {},
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [editLocks, setEditLocks] = useState<EditLock[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const initializeCollaboration = useCallback(async () => {
    try {
      await collaborativeService.initialize(userId, roomId);

      // Set up event listeners
      const unsubscribeState = collaborativeService.onStateChange((state) => {
        setSharedState(state);
      });
      const unsubscribeParticipants = collaborativeService.onParticipantsChange(
        (participants) => {
          setParticipants(participants);
        }
      );
      const unsubscribeLocks = collaborativeService.onLocksChange((locks) => {
        setEditLocks(locks);
      });
      const unsubscribePresence = collaborativeService.onPresenceChange(
        (userId, presence) => {
          // Handle presence updates (cursor positions, etc.)
          setParticipants((prev) =>
            prev.map((p) => (p.userId === userId ? { ...p, ...presence } : p))
          );
        }
      );

      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);

      socketService.on("connect", handleConnect);
      socketService.on("disconnect", handleDisconnect);
      setIsConnected(socketService.isConnected());

      return () => {
        unsubscribeState();
        unsubscribeParticipants();
        unsubscribeLocks();
        unsubscribePresence();
        socketService.off("connect", handleConnect);
        socketService.off("disconnect", handleDisconnect);
      };
    } catch (error) {
      console.error("Error initializing collaboration:", error);
    }
  }, [userId, roomId]);

  useEffect(() => {
    initializeCollaboration();
  }, [initializeCollaboration]);

  const updateTask = useCallback(async (taskId: string, updates: any) => {
    await collaborativeService.updateTask(taskId, updates);
  }, []);

  const addTask = useCallback(async (taskId: string, task: any) => {
    await collaborativeService.addTask(taskId, task);
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    await collaborativeService.deleteTask(taskId);
  }, []);

  const requestEditLock = useCallback(async (field: string) => {
    return await collaborativeService.requestEditLock(field);
  }, []);

  const releaseEditLock = useCallback(async (field: string) => {
    await collaborativeService.releaseEditLock(field);
  }, []);

  const updatePresence = useCallback((presence: any) => {
    collaborativeService.updatePresence(presence);
  }, []);

  const setUserActivity = useCallback((isActive: boolean) => {
    collaborativeService.setUserActivity(isActive);
  }, []);

  return {
    sharedState,
    participants,
    editLocks,
    isConnected,
    updateTask,
    addTask,
    deleteTask,
    requestEditLock,
    releaseEditLock,
    updatePresence,
    setUserActivity,
  };
};
