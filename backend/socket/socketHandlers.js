const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const logger = require('../utils/logger');
const { sendNewMessageEmail } = require('../utils/emailService');

// Store connected users
const connectedUsers = new Map();
let ioInstance;

// Setup socket handlers
const setupSocketHandlers = (io) => {
  ioInstance = io;
  
  // Enhanced Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        logger.warn('Socket connection rejected: No token provided.', { ip: socket.handshake.address });
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || user.status !== 'active') {
        logger.warn(`Socket connection rejected: Invalid or inactive user. UserID: ${decoded.id}`);
        return next(new Error('Authentication error'));
      }

      socket.user = user;
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error.message);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.name} (ID: ${socket.user._id})`);

    // Store connected user
    connectedUsers.set(socket.user._id.toString(), {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Join user to their personal room
    socket.join(`user:${socket.user._id}`);

    // Handle joining conversations (from first code)
    socket.on('join-conversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }
        
        // Check if user is part of this conversation
        if (!conversation.participants.includes(socket.user._id)) {
          return socket.emit('error', { message: 'Not authorized to join this conversation' });
        }
        
        // Leave previous conversation rooms
        socket.rooms.forEach(room => {
          if (room.startsWith('conversation:')) {
            socket.leave(room);
          }
        });

        socket.join(`conversation:${conversationId}`);
        
        // Reset unread count for this user
        await conversation.resetUnreadCount(socket.user._id);
        
        socket.emit('joined-conversation', conversationId);
        logger.info(`User ${socket.user._id} joined conversation: ${conversationId}`);
      } catch (error) {
        socket.emit('error', { message: 'Error joining conversation' });
        logger.error('Error joining conversation:', error);
      }
    });

    // Enhanced message sending with features from both codes
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, content, type = 'text', attachments = [], replyTo = null, metadata = {} } = data;
        
        if (!conversationId || !content) {
          return socket.emit('error', { message: 'Conversation ID and content are required' });
        }

        // Validate user belongs to conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(socket.user._id)) {
          return socket.emit('error', { message: 'Not authorized to send message' });
        }
        
        // Create and save message
        const newMessage = new Message({
          conversation: conversationId,
          sender: socket.user._id,
          recipient: conversation.participants.find(p => p.toString() !== socket.user._id.toString()),
          content,
          type,
          attachments,
          replyTo,
          metadata,
          timestamp: new Date()
        });
        
        await newMessage.save();
        
        // Update conversation with latest message
        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        // Populate message with sender details
        const populatedMessage = await Message.findById(newMessage._id)
          .populate('sender', 'firstName lastName company.name profile.avatar')
          .populate('recipient', 'firstName lastName company.name profile.avatar')
          .populate('replyTo', 'content sender');

        // Prepare message data for broadcasting
        const messageData = {
          _id: populatedMessage._id,
          conversation: populatedMessage.conversation,
          content: populatedMessage.content,
          type: populatedMessage.type,
          attachments: populatedMessage.attachments,
          replyTo: populatedMessage.replyTo,
          metadata: populatedMessage.metadata,
          sender: {
            _id: populatedMessage.sender._id,
            name: `${populatedMessage.sender.firstName} ${populatedMessage.sender.lastName}`,
            avatar: populatedMessage.sender.profile?.avatar,
            company: populatedMessage.sender.company?.name
          },
          recipient: populatedMessage.recipient ? {
            _id: populatedMessage.recipient._id,
            name: `${populatedMessage.recipient.firstName} ${populatedMessage.recipient.lastName}`,
            avatar: populatedMessage.recipient.profile?.avatar,
            company: populatedMessage.recipient.company?.name
          } : null,
          timestamp: populatedMessage.timestamp,
          read: false,
          delivered: false
        };
        
        // Broadcast to all participants in the conversation
        io.to(`conversation:${conversationId}`).emit('new-message', messageData);
        
        // Send email notification to recipient if they're not online
        const recipient = conversation.participants.find(p => p.toString() !== socket.user._id.toString());
        if (recipient) {
          const recipientUser = await User.findById(recipient);
          const isRecipientOnline = connectedUsers.has(recipient.toString());
          
          if (recipientUser && recipientUser.preferences?.notifications?.email && !isRecipientOnline) {
            try {
              await sendNewMessageEmail(
                recipientUser.email,
                recipientUser.firstName,
                `${socket.user.firstName} ${socket.user.lastName}`,
                conversation.title || 'Direct Message'
              );
            } catch (emailError) {
              logger.error('Failed to send message notification email:', emailError);
            }
          }
        }

        // Emit message sent confirmation
        socket.emit('message-sent', { messageId: newMessage._id });
        
        logger.info(`Message sent in conversation ${conversationId} by user ${socket.user._id}`);
      } catch (error) {
        socket.emit('error', { message: 'Error sending message' });
        logger.error('Error sending message:', error);
      }
    });

    // Enhanced read receipts handling
    socket.on('mark-read', async (data) => {
      try {
        const { conversationId, messageId } = data;
        
        if (!conversationId || !messageId) {
          return socket.emit('error', { message: 'Conversation ID and Message ID are required' });
        }

        // Mark messages as read
        await Message.updateMany(
          { 
            conversation: conversationId,
            _id: { $lte: messageId },
            sender: { $ne: socket.user._id },
            read: false
          },
          { read: true, readAt: new Date() }
        );
        
        // Emit read status to conversation participants
        io.to(`conversation:${conversationId}`).emit('messages-read', {
          reader: socket.user._id,
          conversationId,
          messageId,
          readAt: new Date()
        });
        
        logger.info(`Messages marked as read by user ${socket.user._id} in conversation ${conversationId}`);
      } catch (error) {
        socket.emit('error', { message: 'Error marking messages as read' });
        logger.error('Error marking messages as read:', error);
      }
    });

    // Enhanced delivered status handling
    socket.on('mark-delivered', async (data) => {
      try {
        const { conversationId, messageIds } = data;
        
        if (!messageIds || !Array.isArray(messageIds)) {
          return socket.emit('error', { message: 'Message IDs are required' });
        }

        // Mark messages as delivered
        await Message.updateMany(
          { 
            _id: { $in: messageIds },
            sender: { $ne: socket.user._id },
            delivered: false
          },
          { delivered: true, deliveredAt: new Date() }
        );

        // Emit delivered status to conversation participants
        const messages = await Message.find({ _id: { $in: messageIds } });
        const conversationIds = [...new Set(messages.map(m => m.conversation.toString()))];

        conversationIds.forEach(convId => {
          io.to(`conversation:${convId}`).emit('messages-delivered', {
            conversationId: convId,
            messageIds,
            deliveredTo: socket.user._id,
            deliveredAt: new Date()
          });
        });

        logger.info(`Messages marked as delivered by user ${socket.user._id}`);
      } catch (error) {
        socket.emit('error', { message: 'Error marking messages as delivered' });
        logger.error('Error marking messages as delivered:', error);
      }
    });

    // Enhanced typing indicators (from first code)
    socket.on('typing', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        user: socket.user._id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        conversationId
      });
    });
    
    socket.on('stop-typing', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user-stop-typing', {
        user: socket.user._id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        conversationId
      });
    });

    // Handle leave conversation
    socket.on('leave-conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        socket.emit('left-conversation', { conversationId });
        logger.info(`User ${socket.user._id} left conversation: ${conversationId}`);
      }
    });

    // Handle user status updates
    socket.on('update-status', (status) => {
      const userData = connectedUsers.get(socket.user._id.toString());
      if (userData) {
        userData.status = status;
        userData.lastSeen = new Date();
        
        // Emit status update to all connected users
        io.emit('user-status-update', {
          userId: socket.user._id,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          status,
          lastSeen: userData.lastSeen
        });
        
        logger.info(`User ${socket.user._id} status updated to: ${status}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.user.name} (ID: ${socket.user._id})`);
      
      // Remove from connected users
      connectedUsers.delete(socket.user._id.toString());
      
      // Emit user offline status
      io.emit('user-offline', {
        userId: socket.user._id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        lastSeen: new Date()
      });
    });
  });

  return io;
};

// Utility functions for external use
const getConnectedUsers = () => {
  return Array.from(connectedUsers.values());
};

const getUserById = (userId) => {
  return connectedUsers.get(userId.toString());
};

const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

const sendToUser = (userId, event, data) => {
  const userData = connectedUsers.get(userId.toString());
  if (userData && ioInstance) {
    ioInstance.to(userData.socketId).emit(event, data);
  }
};

const sendToConversation = (conversationId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`conversation:${conversationId}`).emit(event, data);
  }
};

const broadcastToAll = (event, data) => {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
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