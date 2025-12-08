import { useState, useEffect, useCallback } from "react";
import { chatService, TypingUser } from "@/src/services/chatService";
import { ChatMessage, ChatRoom } from "@/src/services/chatDatabase";

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

  const sortMessages = (arr: ChatMessage[]) => {
    return [...arr].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  // 🔥 FINAL DEDUPE FUNCTION — no more duplicates, no more bad merges
  const preventDuplicateMessages = useCallback(
    (incoming: ChatMessage, prev: ChatMessage[]) => {
      const cleaned = prev.filter(
        (m) =>
          m.id !== incoming.id &&
          m.tempId !== incoming.tempId &&
          m.id !== incoming.tempId &&
          m.tempId !== incoming.id
      );

      cleaned.push(incoming);
      return sortMessages(cleaned);
    },
    []
  );

  useEffect(() => {
    let unsubscribeMessage: (() => void) | null = null;
    let unsubscribeTyping: (() => void) | null = null;
    let unsubscribeDelivery: (() => void) | null = null;

    const init = async () => {
      setIsLoading(true);
      await chatService.initialize(userId, userName);

      const existingRooms = await chatService.getAllRooms();
      setRooms(existingRooms);

      // ❗ FIXED: incoming message handling
      unsubscribeMessage = chatService.onMessage((message) => {
        setMessages((prev) => preventDuplicateMessages(message, prev));
      });

      unsubscribeTyping = chatService.onTyping((typingUser) => {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.userId !== typingUser.userId);
          return typingUser.isTyping ? [...filtered, typingUser] : filtered;
        });
      });

      // ❗ FIXED DELIVERY HANDLER
      unsubscribeDelivery = chatService.onDelivery((tempId, messageId) => {
        setMessages((prev) => {
          const tempMsg = prev.find((m) => m.tempId === tempId);
          if (!tempMsg) return prev;

          const finalMsg: ChatMessage = {
            ...tempMsg,
            id: messageId,
            delivered: true,
            tempId: undefined,
            timestamp: tempMsg.timestamp ?? new Date().toISOString(), // prevent invalid date
          };

          const cleaned = prev.filter(
            (m) => m.tempId !== tempId && m.id !== tempId && m.id !== messageId
          );

          cleaned.push(finalMsg);
          return sortMessages(cleaned);
        });
      });

      setIsLoading(false);
    };

    init();

    return () => {
      unsubscribeMessage?.();
      unsubscribeTyping?.();
      unsubscribeDelivery?.();
    };
  }, [userId, userName, preventDuplicateMessages]);

  const joinRoom = useCallback(async (roomId: string, roomName: string) => {
    try {
      setIsLoading(true);
      setMessages([]);

      await chatService.joinRoom(roomId, roomName);

      const roomMessages = await chatService.getMessagesForRoom(roomId);

      setMessages(sortMessages(roomMessages));
      setCurrentRoom(roomId);
      setMessageOffset(roomMessages.length);

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
        const merged = [...olderMessages, ...messages];
        setMessages(sortMessages(merged));
        setMessageOffset((prev) => prev + olderMessages.length);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentRoom, messageOffset, isLoading, messages]);

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
