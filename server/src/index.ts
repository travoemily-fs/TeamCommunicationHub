require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:19006",
      process.env.EXPO_PUBLIC_SOCKET_URL || "http://10.0.0.52:3001",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// In-memory storage for demonstration (use database in production)
const chatRooms = new Map();
const userSessions = new Map();

// Collaborative state storage
const collaborativeRooms = new Map();
const userPresence = new Map();

// Collaborative state management
class CollaborativeRoom {
  roomId: string;
  sharedState: any;
  participants: Map<string, any>;
  activeEditors: Map<string, string>;
  operationHistory: any[];
  lastOperationId: number;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.sharedState = {};
    this.participants = new Map();
    this.activeEditors = new Map(); // field -> userId
    this.operationHistory = [];
    this.lastOperationId = 0;
  }

  addParticipant(userId: string, userName: string, socketId: string) {
    this.participants.set(userId, {
      userId,
      userName,
      socketId,
      cursor: null,
      selection: null,
      lastActivity: new Date().toISOString(),
      isActive: true,
    });
  }

  removeParticipant(userId: string) {
    this.participants.delete(userId);
    // Remove any active edits by this user
    for (const [field, editorId] of this.activeEditors.entries()) {
      if (editorId === userId) {
        this.activeEditors.delete(field);
      }
    }
  }

  applyOperation(operation: any) {
    const opId = ++this.lastOperationId;
    const timestampedOp = {
      ...operation,
      id: opId,
      timestamp: new Date().toISOString(),
    };

    // Apply operation to shared state
    this.updateSharedState(timestampedOp);

    // Store in history for new clients
    this.operationHistory.push(timestampedOp);

    // Keep only last 100 operations
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-100);
    }

    return timestampedOp;
  }

  updateSharedState(operation: any) {
    const { type, path, value, userId } = operation;

    switch (type) {
      case "SET_VALUE":
        this.setNestedValue(this.sharedState, path, value);
        break;
      case "UPDATE_TASK":
        if (!this.sharedState.tasks) this.sharedState.tasks = {};
        this.sharedState.tasks[operation.taskId] = {
          ...this.sharedState.tasks[operation.taskId],
          ...operation.updates,
          lastModifiedBy: userId,
          lastModifiedAt: operation.timestamp,
        };
        break;
      case "ADD_TASK":
        if (!this.sharedState.tasks) this.sharedState.tasks = {};
        this.sharedState.tasks[operation.taskId] = operation.task;
        break;
      case "DELETE_TASK":
        if (this.sharedState.tasks) {
          delete this.sharedState.tasks[operation.taskId];
        }
        break;
    }
  }

  setNestedValue(obj: any, path: string, value: any) {
    const keys = path.split(".");
    const lastKey = keys.pop() as string;
    const target = keys.reduce((current: any, key: string) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  startEditing(userId: string, field: string) {
    const currentEditor = this.activeEditors.get(field);
    if (currentEditor && currentEditor !== userId) {
      return { success: false, currentEditor };
    }

    this.activeEditors.set(field, userId);
    return { success: true };
  }

  stopEditing(userId: string, field: string) {
    if (this.activeEditors.get(field) === userId) {
      this.activeEditors.delete(field);
    }
  }

  updatePresence(userId: string, presenceData: any) {
    const participant = this.participants.get(userId);
    if (participant) {
      Object.assign(participant, presenceData, {
        lastActivity: new Date().toISOString(),
        isActive: true,
      });
    }
  }

  getActiveEditors() {
    const activeEdits: any = {};
    for (const [field, userId] of this.activeEditors.entries()) {
      const user = this.participants.get(userId);
      if (user) {
        activeEdits[field] = {
          userId,
          userName: user.userName,
          startedAt: user.lastActivity,
        };
      }
    }
    return activeEdits;
  }

  getParticipantsList() {
    return Array.from(this.participants.values()).map((p: any) => ({
      userId: p.userId,
      userName: p.userName,
      isActive: p.isActive,
      cursor: p.cursor,
      selection: p.selection,
      lastActivity: p.lastActivity,
    }));
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Chat API endpoints
app.get("/api/chat/rooms", (req: any, res: any) => {
  const rooms = Array.from(chatRooms.keys());
  res.json({ rooms });
});

app.get("/api/chat/rooms/:roomId/messages", (req: any, res: any) => {
  const { roomId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const roomData = chatRooms.get(roomId) || { messages: [] };
  const messages = roomData.messages.slice(offset, offset + limit).reverse(); // Most recent first

  res.json({ messages, hasMore: offset + limit < roomData.messages.length });
});

// Socket.io connection handling
io.on("connection", (socket: any) => {
  console.log(`User connected: ${socket.id}`);

  // User joins with profile information
  socket.on("user_join", (userData: any) => {
    userSessions.set(socket.id, {
      ...userData,
      socketId: socket.id,
      joinedAt: new Date().toISOString(),
      isOnline: true,
    });

    socket.emit("user_joined", {
      success: true,
      user: userSessions.get(socket.id),
    });
  });

  // Join chat room
  socket.on("join_room", (data: any) => {
    const { roomId, userId, userName } = data;

    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!chatRooms.has(roomId)) {
      chatRooms.set(roomId, {
        id: roomId,
        messages: [],
        participants: new Map(),
        typingUsers: new Set(),
      });
    }

    const room = chatRooms.get(roomId);
    room.participants.set(userId, {
      userId,
      userName,
      socketId: socket.id,
      joinedAt: new Date().toISOString(),
    });

    // Send recent message history
    const recentMessages = room.messages.slice(-20);
    socket.emit("room_joined", {
      roomId,
      messages: recentMessages,
      participants: Array.from(room.participants.values()),
    });

    // Notify others of user joining
    socket.to(roomId).emit("user_joined_room", {
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });

    console.log(`User ${userName} joined room ${roomId}`);
  });

  // Handle new messages
  socket.on("send_message", (data: any) => {
    const { roomId, message } = data;
    const room = chatRooms.get(roomId);

    if (!room) {
      socket.emit("message_error", { error: "Room not found" });
      return;
    }

    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...message,
      timestamp: new Date().toISOString(),
      deliveredTo: [],
      readBy: [],
    };

    // Save message to room
    room.messages.push(messageData);

    // Broadcast to all users in room
    io.to(roomId).emit("new_message", messageData);

    // Confirm delivery to sender
    socket.emit("message_delivered", {
      tempId: message.tempId,
      messageId: messageData.id,
      timestamp: messageData.timestamp,
    });

    console.log(
      `Message sent in room ${roomId}:`,
      messageData.text.substring(0, 50)
    );
  });

  // Handle typing indicators
  socket.on("typing_start", (data: any) => {
    const { roomId, userId, userName } = data;
    const room = chatRooms.get(roomId);

    if (room) {
      room.typingUsers.add(userId);
      socket.to(roomId).emit("user_typing", {
        userId,
        userName,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("typing_stop", (data: any) => {
    const { roomId, userId, userName } = data;
    const room = chatRooms.get(roomId);

    if (room) {
      room.typingUsers.delete(userId);
      socket.to(roomId).emit("user_typing", {
        userId,
        userName,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle message read receipts
  socket.on("mark_messages_read", (data: any) => {
    const { roomId, messageIds, userId } = data;
    const room = chatRooms.get(roomId);

    if (room) {
      messageIds.forEach((messageId: string) => {
        const message = room.messages.find((m: any) => m.id === messageId);
        if (message && !message.readBy.includes(userId)) {
          message.readBy.push(userId);
        }
      });

      // Notify other users of read receipts
      socket.to(roomId).emit("messages_read", {
        messageIds,
        userId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("join_collaborative_room", (data: any) => {
    const { roomId, userId, userName } = data;

    socket.join(roomId);

    // Get or create collaborative room
    if (!collaborativeRooms.has(roomId)) {
      collaborativeRooms.set(roomId, new CollaborativeRoom(roomId));
    }

    const room = collaborativeRooms.get(roomId);
    room.addParticipant(userId, userName, socket.id);

    // Send current state to new participant
    socket.emit("collaborative_state_sync", {
      roomId,
      sharedState: room.sharedState,
      operationHistory: room.operationHistory.slice(-20), // Last 20 operations
      participants: room.getParticipantsList(),
      activeEditors: room.getActiveEditors(),
    });

    // Notify others of new participant
    socket.to(roomId).emit("participant_joined", {
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });

    // Broadcast updated participant list
    io.to(roomId).emit("participants_updated", {
      participants: room.getParticipantsList(),
    });
  });

  socket.on("collaborative_operation", (data: any) => {
    const { roomId, operation } = data;
    const room = collaborativeRooms.get(roomId);

    if (!room) {
      socket.emit("operation_error", { error: "Room not found" });
      return;
    }

    // Apply operation and get timestamped version
    const processedOperation = room.applyOperation(operation);

    // Broadcast to all clients in room
    io.to(roomId).emit("operation_applied", {
      operation: processedOperation,
      sharedState: room.sharedState,
    });

    console.log(
      `Operation applied in room ${roomId}:`,
      processedOperation.type
    );
  });

  socket.on("request_edit_lock", (data: any) => {
    const { roomId, field, userId } = data;
    const room = collaborativeRooms.get(roomId);

    if (!room) {
      socket.emit("edit_lock_response", {
        success: false,
        error: "Room not found",
        field,
      });
      return;
    }

    const result = room.startEditing(userId, field);

    socket.emit("edit_lock_response", {
      success: result.success,
      field,
      currentEditor: result.currentEditor,
    });

    if (result.success) {
      // Notify others that this field is being edited
      socket.to(roomId).emit("field_locked", {
        field,
        userId,
        userName: room.participants.get(userId)?.userName,
      });
    }
  });

  socket.on("release_edit_lock", (data: any) => {
    const { roomId, field, userId } = data;
    const room = collaborativeRooms.get(roomId);

    if (room) {
      room.stopEditing(userId, field);

      // Notify others that field is available
      socket.to(roomId).emit("field_unlocked", {
        field,
        userId,
      });
    }
  });

  socket.on("update_presence", (data: any) => {
    const { roomId, userId, presenceData } = data;
    const room = collaborativeRooms.get(roomId);

    if (room) {
      room.updatePresence(userId, presenceData);

      // Broadcast presence update to others
      socket.to(roomId).emit("presence_updated", {
        userId,
        presenceData,
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("user_activity_change", (data: any) => {
    const { roomId, userId, isActive } = data;
    const room = collaborativeRooms.get(roomId);

    if (room) {
      const participant = room.participants.get(userId);
      if (participant) {
        participant.isActive = isActive;
        participant.lastActivity = new Date().toISOString();

        // Broadcast activity change
        socket.to(roomId).emit("user_activity_updated", {
          userId,
          isActive,
          timestamp: participant.lastActivity,
        });
      }
    }
  });

  // Handle disconnection
  socket.on("disconnect", (reason: string) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

    // Remove user from all rooms
    chatRooms.forEach((room: any, roomId: any) => {
      const userToRemove: any = Array.from(room.participants.values()).find(
        (p: any) => p.socketId === socket.id
      );

      if (userToRemove) {
        room.participants.delete(userToRemove.userId);
        room.typingUsers.delete(userToRemove.userId);

        // Notify others of user leaving
        socket.to(roomId).emit("user_left_room", {
          userId: userToRemove.userId,
          userName: userToRemove.userName,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Remove user from all collaborative rooms
    collaborativeRooms.forEach((room: any, roomId: any) => {
      const userToRemove: any = Array.from(room.participants.values()).find(
        (p: any) => p.socketId === socket.id
      );

      if (userToRemove) {
        room.removeParticipant(userToRemove.userId);

        socket.to(roomId).emit("participant_left", {
          userId: userToRemove.userId,
          userName: userToRemove.userName,
          timestamp: new Date().toISOString(),
        });

        socket.to(roomId).emit("participants_updated", {
          participants: room.getParticipantsList(),
        });

        socket.to(roomId).emit("user_fields_unlocked", {
          userId: userToRemove.userId,
        });
      }
    });

    userSessions.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for chat connections`);
});
