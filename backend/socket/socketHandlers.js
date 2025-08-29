const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { sendNewMessageEmail } = require('../utils/emailService');

// Store connected users
const connectedUsers = new Map();

// Setup socket handlers
const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || user.status !== 'active') {
        return next(new Error('Invalid or inactive user'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.firstName} ${socket.user.lastName} (${socket.user._id})`);
    
    // Store connected user
    connectedUsers.set(socket.user._id.toString(), {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Join user to their personal room
    socket.join(`user_${socket.user._id}`);

    // Handle user typing
    socket.on('typing', async (data) => {
      try {
        const { conversationId, isTyping } = data;
        
        if (!conversationId) return;

        // Get conversation and check if user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.user._id)) {
          return;
        }

        // Emit typing status to other participants
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          conversationId,
          userId: socket.user._id,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          isTyping
        });
      } catch (error) {
        console.error('Typing error:', error);
      }
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, type = 'text', attachments = [], replyTo = null, metadata = {} } = data;

        if (!conversationId || !content) {
          socket.emit('message_error', { message: 'Conversation ID and content are required' });
          return;
        }

        // Get conversation and check if user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.user._id)) {
          socket.emit('message_error', { message: 'Access denied to this conversation' });
          return;
        }

        // Create message
        const message = new Message({
          conversation: conversationId,
          sender: socket.user._id,
          recipient: conversation.participants.find(p => p.toString() !== socket.user._id.toString()),
          content,
          type,
          attachments,
          replyTo,
          metadata
        });

        await message.save();

        // Update conversation last message
        await conversation.updateLastMessage(message._id, message.createdAt);

        // Populate message for sending
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'firstName lastName company.name profile.avatar')
          .populate('recipient', 'firstName lastName company.name profile.avatar')
          .populate('replyTo', 'content sender');

        // Emit message to conversation room
        io.to(`conversation_${conversationId}`).emit('new_message', {
          message: populatedMessage,
          conversationId
        });

        // Send email notification to recipient if they're not online
        const recipient = conversation.participants.find(p => p.toString() !== socket.user._id.toString());
        if (recipient) {
          const recipientUser = await User.findById(recipient);
          if (recipientUser && recipientUser.preferences?.notifications?.email) {
            try {
              await sendNewMessageEmail(
                recipientUser.email,
                recipientUser.firstName,
                `${socket.user.firstName} ${socket.user.lastName}`,
                conversation.title || 'Direct Message'
              );
            } catch (emailError) {
              console.error('Failed to send message notification email:', emailError);
            }
          }
        }

        // Emit message sent confirmation
        socket.emit('message_sent', { messageId: message._id });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    // Handle message read
    socket.on('mark_read', async (data) => {
      try {
        const { messageIds } = data;
        
        if (!messageIds || !Array.isArray(messageIds)) {
          return;
        }

        // Mark messages as read
        await Message.markAsRead(messageIds, socket.user._id);

        // Emit read status to conversation participants
        const messages = await Message.find({ _id: { $in: messageIds } });
        const conversationIds = [...new Set(messages.map(m => m.conversation.toString()))];

        conversationIds.forEach(conversationId => {
          io.to(`conversation_${conversationId}`).emit('messages_read', {
            conversationId,
            messageIds,
            readBy: socket.user._id,
            readAt: new Date()
          });
        });

      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle message delivered
    socket.on('mark_delivered', async (data) => {
      try {
        const { messageIds } = data;
        
        if (!messageIds || !Array.isArray(messageIds)) {
          return;
        }

        // Mark messages as delivered
        await Message.markAsDelivered(messageIds, socket.user._id);

        // Emit delivered status to conversation participants
        const messages = await Message.find({ _id: { $in: messageIds } });
        const conversationIds = [...new Set(messages.map(m => m.conversation.toString()))];

        conversationIds.forEach(conversationId => {
          io.to(`conversation_${conversationId}`).emit('messages_delivered', {
            conversationId,
            messageIds,
            deliveredTo: socket.user._id,
            deliveredAt: new Date()
          });
        });

      } catch (error) {
        console.error('Mark delivered error:', error);
      }
    });

    // Handle join conversation
    socket.on('join_conversation', async (conversationId) => {
      try {
        if (!conversationId) return;

        // Check if user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.user._id)) {
          socket.emit('conversation_error', { message: 'Access denied to this conversation' });
          return;
        }

        // Leave previous conversation rooms
        socket.rooms.forEach(room => {
          if (room.startsWith('conversation_')) {
            socket.leave(room);
          }
        });

        // Join new conversation room
        socket.join(`conversation_${conversationId}`);
        
        // Reset unread count for this user
        await conversation.resetUnreadCount(socket.user._id);

        socket.emit('conversation_joined', { conversationId });

      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('conversation_error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leave conversation
    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation_${conversationId}`);
        socket.emit('conversation_left', { conversationId });
      }
    });

    // Handle user status
    socket.on('update_status', (status) => {
      const userData = connectedUsers.get(socket.user._id.toString());
      if (userData) {
        userData.status = status;
        userData.lastSeen = new Date();
        
        // Emit status update to all connected users
        io.emit('user_status_update', {
          userId: socket.user._id,
          status,
          lastSeen: userData.lastSeen
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.firstName} ${socket.user.lastName} (${socket.user._id})`);
      
      // Remove from connected users
      connectedUsers.delete(socket.user._id.toString());
      
      // Emit user offline status
      io.emit('user_offline', {
        userId: socket.user._id,
        lastSeen: new Date()
      });
    });
  });

  // Return io instance for potential external use
  return io;
};

// Get connected users
const getConnectedUsers = () => {
  return Array.from(connectedUsers.values());
};

// Get user by ID
const getUserById = (userId) => {
  return connectedUsers.get(userId.toString());
};

// Check if user is online
const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

// Send message to specific user
const sendToUser = (userId, event, data) => {
  const userData = connectedUsers.get(userId.toString());
  if (userData) {
    io.to(userData.socketId).emit(event, data);
  }
};

// Send message to conversation
const sendToConversation = (conversationId, event, data) => {
  io.to(`conversation_${conversationId}`).emit(event, data);
};

// Broadcast to all users
const broadcastToAll = (event, data) => {
  io.emit(event, data);
};

module.exports = {
  setupSocketHandlers,
  getConnectedUsers,
  getUserById,
  isUserOnline,
  sendToUser,
  sendToConversation,
  broadcastToAll
};