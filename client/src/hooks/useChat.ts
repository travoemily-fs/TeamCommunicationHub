import { useState, useEffect, useCallback } from "react";
import { chatService, TypingUser } from "@/src/services/chatService";
import { ChatMessage, ChatRoom } from "@/src/services/chatDatabase";

let lastJoinedRoom: string | null = null;

export interface UseChatReturn {
  messages: ChatMessage[];
  typingUsers: TypingUser[];
  rooms: ChatRoom[];
  currentRoom: string | null;
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  joinRoom: (roomId: string, roomName: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  loadMoreMessages: () => Promise<void>;
}

export const useChat = (userId: string, userName: string): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [messageOffset, setMessageOffset] = useState(0);
  useEffect(() => {
    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userName]);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      await chatService.initialize(userId, userName);

      // Load existing rooms
      const existingRooms = await chatService.getAllRooms();
      setRooms(existingRooms);

      // Set up event listeners
      const unsubscribeMessage = chatService.onMessage((message) => {
        setMessages((prev) => {
          // Avoid duplicates
          const exists = prev.some(
            (m) => m.id === message.id || m.tempId === message.tempId
          );
          if (exists) {
            // Update existing message (e.g., delivery status)
            return prev.map((m) =>
              m.id === message.id || m.tempId === message.tempId ? message : m
            );
          }
          return [...prev, message];
        });
      });

      const unsubscribeTyping = chatService.onTyping((typingUser) => {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.userId !== typingUser.userId);
          return typingUser.isTyping ? [...filtered, typingUser] : filtered;
        });
      });

      const unsubscribeDelivery = chatService.onDelivery(
        (tempId, messageId) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === tempId
                ? { ...m, id: messageId, delivered: true, tempId: undefined }
                : m
            )
          );
        }
      );

      return () => {
        unsubscribeMessage();
        unsubscribeTyping();
        unsubscribeDelivery();
      };
    } catch (error) {
      console.error("Error initializing chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = useCallback(async (roomId: string, roomName: string) => {
 
    if(lastJoinedRoom === roomId) {
      return;
    }

    lastJoinedRoom = roomId;

    try {
      setIsLoading(true);
      await chatService.joinRoom(roomId, roomName);

      // Load messages for this room
      const roomMessages = await chatService.getMessagesForRoom(roomId);
      setMessages(roomMessages);
      setCurrentRoom(roomId);
      setMessageOffset(roomMessages.length);

      // Clear typing indicators when switching rooms
      setTypingUsers([]);
    } catch (error) {
      console.error("Error joining room:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    try {
      await chatService.sendMessage(text);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, []);

  const startTyping = useCallback(() => {
    chatService.startTyping();
  }, []);

  const stopTyping = useCallback(() => {
    chatService.stopTyping();
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!currentRoom || isLoading) return;

    try {
      setIsLoading(true);
      const olderMessages = await chatService.getMessagesForRoom(
        currentRoom,
        20,
        messageOffset
      );

      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
        setMessageOffset((prev) => prev + olderMessages.length);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentRoom, messageOffset, isLoading]);

  return {
    messages,
    typingUsers,
    rooms,
    currentRoom,
    isLoading,
    sendMessage,
    joinRoom,
    startTyping,
    stopTyping,
    loadMoreMessages,
  };
};
