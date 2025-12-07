import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

export interface ChatMessage {
  id: string;
  tempId?: string;
  roomId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  delivered: boolean;
  read: boolean;
  type: "text" | "system" | "typing";
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

  private webRooms: ChatRoom[] = [];
  private webMessages: ChatMessage[] = [];

  async initializeDatabase(): Promise<void> {
    if (Platform.OS === "web") {
      console.log("SQLite not used on web.");
      this.db = {} as any;
      return;
    }
    try {
      this.db = await SQLite.openDatabaseAsync("chat.db");

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

      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp 
        ON chat_messages(room_id, timestamp DESC);
      `);

      console.log("Chat database initialized successfully");
    } catch (error) {
      console.error("Chat database initialization error:", error);
      throw error;
    }
  }

  async createOrUpdateRoom(room: ChatRoom): Promise<void> {
    if (Platform.OS === "web") {
      const existing = this.webRooms.find(r => r.id === room.id);
      if (existing) {
        Object.assign(existing, room);
      } else {
        this.webRooms.push({ ...room });
      }
      return;
    }

    if (!this.db) throw new Error("Database not initialized");

    try {
      const now = new Date().toISOString();
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO chat_rooms 
        (id, name, description, last_message, last_message_time, unread_count, participants, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          room.id,
          room.name,
          room.description || "",
          room.lastMessage || "",
          room.lastMessageTime || "",
          room.unreadCount,
          JSON.stringify(room.participants),
          now,
          now,
        ]
      );
    } catch (error) {
      console.error("Error creating/updating room:", error);
      throw error;
    }
  }

  async getAllRooms(): Promise<ChatRoom[]> {
    if (Platform.OS === "web") {
      return this.webRooms;
    }

    if (!this.db) throw new Error("Database not initialized");

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
        participants: JSON.parse(row.participants || "[]"),
      }));
    } catch (error) {
      console.error("Error fetching rooms:", error);
      throw error;
    }
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    if (Platform.OS === "web") {
      const idx = this.webMessages.findIndex(m => m.id === message.id);
      if (idx >= 0) {
        this.webMessages[idx] = message;
      } else {
        this.webMessages.push(message);
      }
      return;
    }

    if (!this.db) throw new Error("Database not initialized");

    try {
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO chat_messages 
        (id, temp_id, room_id, user_id, user_name, text, timestamp, delivered, read, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
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
          new Date().toISOString(),
        ]
      );

      await this.updateRoomLastMessage(
        message.roomId,
        message.text,
        message.timestamp
      );
    } catch (error) {
      console.error("Error saving message:", error);
      throw error;
    }
  }

  async getMessagesForRoom(
    roomId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    if (Platform.OS === "web") {
      return this.webMessages
        .filter(m => m.roomId === roomId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    if (!this.db) throw new Error("Database not initialized");

    try {
      const result = await this.db.getAllAsync(
        `
        SELECT * FROM chat_messages 
        WHERE room_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `,
        [roomId, limit, offset]
      );

      return result
        .map((row: any) => ({
          id: row.id,
          tempId: row.temp_id,
          roomId: row.room_id,
          userId: row.user_id,
          userName: row.user_name,
          text: row.text,
          timestamp: row.timestamp,
          delivered: Boolean(row.delivered),
          read: Boolean(row.read),
          type: row.type as "text" | "system" | "typing",
        }))
        .reverse();
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  async updateMessageDeliveryStatus(
    tempId: string,
    messageId: string,
    delivered: boolean = true
  ): Promise<void> {
    if (Platform.OS === "web") {
      const msg = this.webMessages.find(m => m.tempId === tempId);
      if (msg) {
        msg.id = messageId;
        msg.delivered = delivered;
        msg.tempId = undefined;
      }
      return;
    }

    if (!this.db) throw new Error("Database not initialized");

    try {
      await this.db.runAsync(
        `
        UPDATE chat_messages 
        SET id = ?, delivered = ?, temp_id = NULL 
        WHERE temp_id = ?
      `,
        [messageId, delivered ? 1 : 0, tempId]
      );
    } catch (error) {
      console.error("Error updating message delivery status:", error);
      throw error;
    }
  }
  
  async markMessagesAsRead(
    roomId: string,
    messageIds: string[]
  ): Promise<void> {
    if (Platform.OS === "web") {
      this.webMessages.forEach(m => {
        if (m.roomId === roomId && messageIds.includes(m.id)) {
          m.read = true;
        }
      });
      return;
    }

    if (!this.db) throw new Error("Database not initialized");

    try {
      const placeholders = messageIds.map(() => "?").join(",");
      await this.db.runAsync(
        `
        UPDATE chat_messages 
        SET read = 1 
        WHERE room_id = ? AND id IN (${placeholders})
      `,
        [roomId, ...messageIds]
      );

      await this.updateUnreadCount(roomId);
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  private async updateRoomLastMessage(
    roomId: string,
    message: string,
    timestamp: string
  ): Promise<void> {
    if (Platform.OS === "web") {
      const room = this.webRooms.find(r => r.id === roomId);
      if (room) {
        room.lastMessage = message;
        room.lastMessageTime = timestamp;
      }
      return;
    }

    await this.db!.runAsync(
      `
      UPDATE chat_rooms 
      SET last_message = ?, last_message_time = ?, updated_at = ?
      WHERE id = ?
    `,
      [message, timestamp, new Date().toISOString(), roomId]
    );
  }

  private async updateUnreadCount(roomId: string): Promise<void> {
    if (Platform.OS === "web") {
      return;
    }

    const result = await this.db!.getFirstAsync(
      `
      SELECT COUNT(*) as unread_count 
      FROM chat_messages 
      WHERE room_id = ? AND read = 0
    `,
      [roomId]
    );

    const unreadCount = (result as any)?.unread_count || 0;

    await this.db!.runAsync(
      `
      UPDATE chat_rooms 
      SET unread_count = ? 
      WHERE id = ?
    `,
      [unreadCount, roomId]
    );
  }
}

export const chatDatabaseService = new ChatDatabaseService();
