import { socketService } from '@/src/services/socketService';
import { chatDatabaseService, ChatMessage, ChatRoom } from '@/src/services/chatDatabase';

export interface TypingUser {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: string;
}

export interface ChatUser {
  userId: string;
  userName: string;
  socketId?: string;
  isOnline: boolean;
}

class ChatService {
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private currentRoomId: string | null = null;
  private typingTimeout: NodeJS.Timeout | null = null;
  private listenersInitialized = false;


  // Event listeners
  private messageListeners: ((message: ChatMessage) => void)[] = [];
  private typingListeners: ((typingUser: TypingUser) => void)[] = [];
  private presenceListeners: ((users: ChatUser[]) => void)[] = [];
  private deliveryListeners: ((tempId: string, messageId: string) => void)[] = [];

  // reaction listeners
  private reactionListeners: ((message: ChatMessage) => void)[] = [];

  async initialize(userId: string, userName: string): Promise<void> {
    this.currentUserId = userId;
    this.currentUserName = userName;
    
    await chatDatabaseService.initializeDatabase();
    this.setupSocketListeners();
    
    // Join user session
    socketService.emit('user_join', {
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });
  }

private setupSocketListeners(): void {
  if (this.listenersInitialized) return;
  this.listenersInitialized = true;

  // Handle new messages
  socketService.on("new_message", (message: ChatMessage) => {
    this.handleNewMessage(message);
  });

  // Handle typing indicators
  socketService.on("user_typing", (data: TypingUser) => {
    this.notifyTypingListeners(data);
  });

  // Handle message delivery confirmation
  socketService.on(
    "message_delivered",
    (data: { tempId: string; messageId: string; timestamp: string }) => {
      this.handleMessageDelivered(data.tempId, data.messageId);
    }
  );

  // Handle room joined
  socketService.on(
    "room_joined",
    async (data: { roomId: string; messages: ChatMessage[]; participants: ChatUser[] }) => {
      await this.handleRoomJoined(data);
    }
  );

  // Handle reactions
  socketService.on("reaction", async (updatedMessage: ChatMessage) => {
    await chatDatabaseService.saveMessage(updatedMessage);
    this.notifyReactionListeners(updatedMessage);
  });
}


  async joinRoom(roomId: string, roomName: string): Promise<void> {
    this.currentRoomId = roomId;
    
    // Create/update room in local database
    await chatDatabaseService.createOrUpdateRoom({
      id: roomId,
      name: roomName,
      unreadCount: 0,
      participants: [this.currentUserId!],
    });
    
    // Join room on server
    socketService.emit('join_room', {
      roomId,
      userId: this.currentUserId,
      userName: this.currentUserName,
    });
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId || !this.currentUserName) {
      throw new Error('Not connected to a room');
    }
    
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   
    const message: ChatMessage = {
      id: tempId, // Will be replaced when server confirms
      tempId,
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      userName: this.currentUserName,
      text,
      timestamp: new Date().toISOString(),
      delivered: false,
      read: true, // Own messages are considered read
      type: 'text',
      // setting up reactions 
      reactions: {},
    };

    // Save optimistically to local database
    await chatDatabaseService.saveMessage(message);
    
    // Notify UI immediately
    this.notifyMessageListeners(message);

    // Send to server
    socketService.emit('send_message', {
      roomId: this.currentRoomId,
      message: {
        tempId,
        userId: this.currentUserId,
        userName: this.currentUserName,
        text,
        type: 'text',
      },
    });
  }

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
  if (!this.currentRoomId || !this.currentUserId) return;

  socketService.emit('toggle_reaction', {
    roomId: this.currentRoomId,
    messageId,
    userId: this.currentUserId,
    emoji,
  });
}
  
  startTyping(): void {
    if (!this.currentRoomId || !this.currentUserId || !this.currentUserName) return;
    socketService.emit('typing_start', {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      userName: this.currentUserName,
    });
    // Auto-stop typing after 3 seconds
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 3000);
  }
  
  stopTyping(): void {
    if (!this.currentRoomId || !this.currentUserId || !this.currentUserName) return;
    socketService.emit('typing_stop', {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      userName: this.currentUserName,
    });
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }
 
  async getMessagesForRoom(roomId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    return await chatDatabaseService.getMessagesForRoom(roomId, limit, offset);
  }
  
  async getAllRooms(): Promise<ChatRoom[]> {
    return await chatDatabaseService.getAllRooms();
  }
  
private async handleNewMessage(message: ChatMessage): Promise<void> {
  // only processes the messages that belong to the room that is currently opened
  if (message.roomId !== this.currentRoomId) return;

  await chatDatabaseService.saveMessage(message);
  this.notifyMessageListeners(message);
}

  
  private async handleMessageDelivered(tempId: string, messageId: string): Promise<void> {
    // Update local database
    await chatDatabaseService.updateMessageDeliveryStatus(tempId, messageId, true);
    
    // Notify UI
    this.notifyDeliveryListeners(tempId, messageId);
  }
  
  private async handleRoomJoined(data: { roomId: string; messages: ChatMessage[]; participants: ChatUser[] }): Promise<void> {
    // Save historical messages to local database
    for (const message of data.messages) {
      await chatDatabaseService.saveMessage(message);
    }
  }
  
  // Event listener management
  onMessage(callback: (message: ChatMessage) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  onTyping(callback: (typingUser: TypingUser) => void): () => void {
    this.typingListeners.push(callback);
    return () => {
      this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
    };
  }

  onDelivery(callback: (tempId: string, messageId: string) => void): () => void {
    this.deliveryListeners.push(callback);
    return () => {
      this.deliveryListeners = this.deliveryListeners.filter(cb => cb !== callback);
    };
  }

  onReaction(callback: (message: ChatMessage) => void): () => void {
    this.reactionListeners.push(callback);
    return () => {
      this.reactionListeners = this.reactionListeners.filter(cb => cb !== callback);
    };
  }

  private notifyMessageListeners(message: ChatMessage): void {
    this.messageListeners.forEach(callback => callback(message));
  }

  private notifyTypingListeners(typingUser: TypingUser): void {
    this.typingListeners.forEach(callback => callback(typingUser));
  }

  private notifyDeliveryListeners(tempId: string, messageId: string): void {
    this.deliveryListeners.forEach(callback => callback(tempId, messageId));
  }

  private notifyReactionListeners(message: ChatMessage): void {
    this.reactionListeners.forEach(callback => callback(message));
  }
}

export const chatService = new ChatService();
