import * as SQLite from 'expo-sqlite';

export interface ChatMessage {
  id: string;
  tempId?: string; // For optimistic updates
  roomId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  delivered: boolean;
  read: boolean;
  type: 'text' | 'system' | 'typing';
}
export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  participants: string[];
}
class ChatDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('chat.db');
      
      // Create chat rooms table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          last_message TEXT,
          last_message_time TEXT,
          unread_count INTEGER DEFAULT 0,
          participants TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      
      // Create messages table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          temp_id TEXT,
          room_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          text TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          delivered INTEGER DEFAULT 0,
          read INTEGER DEFAULT 0,
          type TEXT DEFAULT 'text',
          created_at TEXT NOT NULL,
          FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
        );
      `);
      
      // Create indexes for performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp 
        ON chat_messages(room_id, timestamp DESC);
      `);
      
      console.log('Chat database initialized successfully');
    } catch (error) {
      console.error('Chat database initialization error:', error);
      throw error;
    }
  }
  // Room management
  async createOrUpdateRoom(room: ChatRoom): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const now = new Date().toISOString();
      await this.db.runAsync(`
        INSERT OR REPLACE INTO chat_rooms 
        (id, name, description, last_message, last_message_time, unread_count, participants, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        room.id,
        room.name,
        room.description || '',
        room.lastMessage || '',
        room.lastMessageTime || '',
        room.unreadCount,
        JSON.stringify(room.participants),
        now,
        now
      ]);
    } catch (error) {
      console.error('Error creating/updating room:', error);
      throw error;
    }
  }
  async getAllRooms(): Promise<ChatRoom[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const result = await this.db.getAllAsync(`
        SELECT * FROM chat_rooms 
        ORDER BY last_message_time DESC
      `);
      
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        lastMessage: row.last_message,
        lastMessageTime: row.last_message_time,
        unreadCount: row.unread_count,
        participants: JSON.parse(row.participants || '[]'),
      }));
    } catch (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }
  }
  // Message management
  async saveMessage(message: ChatMessage): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.runAsync(`
        INSERT OR REPLACE INTO chat_messages 
        (id, temp_id, room_id, user_id, user_name, text, timestamp, delivered, read, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        message.id,
        message.tempId || null,
        message.roomId,
        message.userId,
        message.userName,
        message.text,
        message.timestamp,
        message.delivered ? 1 : 0,
        message.read ? 1 : 0,
        message.type,
        new Date().toISOString()
      ]);
      
      // Update room's last message
      await this.updateRoomLastMessage(message.roomId, message.text, message.timestamp);
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }
  async getMessagesForRoom(roomId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const result = await this.db.getAllAsync(`
        SELECT * FROM chat_messages 
        WHERE room_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `, [roomId, limit, offset]);
      
      return result.map((row: any) => ({
        id: row.id,
        tempId: row.temp_id,
        roomId: row.room_id,
        userId: row.user_id,
        userName: row.user_name,
        text: row.text,
        timestamp: row.timestamp,
        delivered: Boolean(row.delivered),
        read: Boolean(row.read),
        type: row.type as 'text' | 'system' | 'typing',
      })).reverse(); // Reverse to show oldest first
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }
  async updateMessageDeliveryStatus(tempId: string, messageId: string, delivered: boolean = true): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      await this.db.runAsync(`
        UPDATE chat_messages 
        SET id = ?, delivered = ?, temp_id = NULL 
        WHERE temp_id = ?
      `, [messageId, delivered ? 1 : 0, tempId]);
    } catch (error) {
      console.error('Error updating message delivery status:', error);
      throw error;
    }
  }
  async markMessagesAsRead(roomId: string, messageIds: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const placeholders = messageIds.map(() => '?').join(',');
      await this.db.runAsync(`
        UPDATE chat_messages 
        SET read = 1 
        WHERE room_id = ? AND id IN (${placeholders})
      `, [roomId, ...messageIds]);
      
      // Update unread count for room
      await this.updateUnreadCount(roomId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }
  private async updateRoomLastMessage(roomId: string, message: string, timestamp: string): Promise<void> {
    await this.db!.runAsync(`
      UPDATE chat_rooms 
      SET last_message = ?, last_message_time = ?, updated_at = ?
      WHERE id = ?
    `, [message, timestamp, new Date().toISOString(), roomId]);
  }
  private async updateUnreadCount(roomId: string): Promise<void> {
    const result = await this.db!.getFirstAsync(`
      SELECT COUNT(*) as unread_count 
      FROM chat_messages 
      WHERE room_id = ? AND read = 0
    `, [roomId]);
    
    const unreadCount = (result as any)?.unread_count || 0;
    
    await this.db!.runAsync(`
      UPDATE chat_rooms 
      SET unread_count = ? 
      WHERE id = ?
    `, [unreadCount, roomId]);
  }
}
export const chatDatabaseService = new ChatDatabaseService();