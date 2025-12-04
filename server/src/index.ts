require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:19006",
      "exp://192.168.1.100:19000",
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// In-memory storage for demonstration (use database in production)
const chatRooms = new Map();
const userSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Chat API endpoints
app.get('/api/chat/rooms', (req: any, res: any) => {
  const rooms = Array.from(chatRooms.keys());
  res.json({ rooms });
});
app.get('/api/chat/rooms/:roomId/messages', (req: any, res: any) => {
  const { roomId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  
  const roomData = chatRooms.get(roomId) || { messages: [] };
  const messages = roomData.messages
    .slice(offset, offset + limit)
    .reverse(); // Most recent first
  
  res.json({ messages, hasMore: offset + limit < roomData.messages.length });
});

// Socket.io connection handling
io.on('connection', (socket:any) => {
  console.log(`User connected: ${socket.id}`);
  
  // User joins with profile information
  socket.on('user_join', (userData: any) => {
    userSessions.set(socket.id, {
      ...userData,
      socketId: socket.id,
      joinedAt: new Date().toISOString(),
      isOnline: true,
    });
    
    socket.emit('user_joined', {
      success: true,
      user: userSessions.get(socket.id),
    });
  });

  // Join chat room
  socket.on('join_room', (data: any) => {
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
    socket.emit('room_joined', {
      roomId,
      messages: recentMessages,
      participants: Array.from(room.participants.values()),
    });
    
    // Notify others of user joining
    socket.to(roomId).emit('user_joined_room', {
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`User ${userName} joined room ${roomId}`);
  });

  // Handle new messages
  socket.on('send_message', (data:any) => {
    const { roomId, message } = data;
    const room = chatRooms.get(roomId);
    
    if (!room) {
      socket.emit('message_error', { error: 'Room not found' });
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
    io.to(roomId).emit('new_message', messageData);
    
    // Confirm delivery to sender
    socket.emit('message_delivered', {
      tempId: message.tempId,
      messageId: messageData.id,
      timestamp: messageData.timestamp,
    });
    
    console.log(`Message sent in room ${roomId}:`, messageData.text.substring(0, 50));
  });
  // Handle typing indicators
  socket.on('typing_start', (data: any) => {
    const { roomId, userId, userName } = data;
    const room = chatRooms.get(roomId);
    
    if (room) {
      room.typingUsers.add(userId);
      socket.to(roomId).emit('user_typing', {
        userId,
        userName,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    }
  });
  socket.on('typing_stop', (data: any) => {
    const { roomId, userId, userName } = data;
    const room = chatRooms.get(roomId);
    
    if (room) {
      room.typingUsers.delete(userId);
      socket.to(roomId).emit('user_typing', {
        userId,
        userName,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    }
  });
  // Handle message read receipts
  socket.on('mark_messages_read', (data:any) => {
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
      socket.to(roomId).emit('messages_read', {
        messageIds,
        userId,
        timestamp: new Date().toISOString(),
      });
    }
  });
  // Handle disconnection
  socket.on('disconnect', (reason: string) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    
    // Remove user from all rooms
    chatRooms.forEach((room: any, roomId: any) => {
      const userToRemove: any = Array.from(room.participants.values())
        .find((p: any) => p.socketId === socket.id);
      
      if (userToRemove) {
        room.participants.delete(userToRemove.userId);
        room.typingUsers.delete(userToRemove.userId);
        
        // Notify others of user leaving
        socket.to(roomId).emit('user_left_room', {
          userId: userToRemove.userId,
          userName: userToRemove.userName,
          timestamp: new Date().toISOString(),
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