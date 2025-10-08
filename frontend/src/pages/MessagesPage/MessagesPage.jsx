import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { Helmet } from 'react-helmet';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_URL } from '../../api/config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';

const MessagesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  // Connect to socket.io server
  useEffect(() => {
    if (user) {
      socketRef.current = io(API_URL, {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      socketRef.current.on('connect', () => {
        setSocketConnected(true);
        console.log('Socket connected');
      });

      socketRef.current.on('error', (error) => {
        console.error('Socket error:', error);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to connect to messaging service"
        });
      });

      socketRef.current.on('new-message', (message) => {
        if (message.conversation === activeConversation?._id) {
          setMessages((prev) => [...prev, message]);
        }
        
        // Update last message in conversation list
        setConversations((prevConversations) => {
          return prevConversations.map((conv) => {
            if (conv._id === message.conversation) {
              return {
                ...conv,
                lastMessage: {
                  content: message.content,
                  timestamp: message.timestamp
                },
                unreadCount: conv._id !== activeConversation?._id 
                  ? (conv.unreadCount || 0) + 1 
                  : 0
              };
            }
            return conv;
          });
        });
      });

      socketRef.current.on('messages-read', ({ conversationId }) => {
        if (conversationId === activeConversation?._id) {
          setMessages((prev) => 
            prev.map((msg) => ({
              ...msg,
              read: true
            }))
          );
        }
      });

      // Cleanup function
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [user, activeConversation, toast]);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/messages/conversations`);
        setConversations(data.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error fetching conversations",
          description: error.response?.data?.error?.message || "Something went wrong"
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchConversations();
    }
  }, [user, toast]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeConversation) return;
      
      try {
        const { data } = await axios.get(`${API_URL}/api/messages/conversations/${activeConversation._id}`);
        setMessages(data.data);
        
        // Join the conversation room
        if (socketRef.current && socketConnected) {
          socketRef.current.emit('join-conversation', activeConversation._id);
          
          // Mark messages as read
          if (data.data.length > 0) {
            const lastMessageId = data.data[data.data.length - 1]._id;
            socketRef.current.emit('mark-read', {
              conversationId: activeConversation._id,
              messageId: lastMessageId
            });
          }
        }
        
        // Update unread count in conversation list
        setConversations((prevConversations) => {
          return prevConversations.map((conv) => {
            if (conv._id === activeConversation._id) {
              return {
                ...conv,
                unreadCount: 0
              };
            }
            return conv;
          });
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error fetching messages",
          description: error.response?.data?.error?.message || "Something went wrong"
        });
      }
    };

    fetchMessages();
  }, [activeConversation, socketConnected, toast]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !activeConversation) return;
    
    if (socketRef.current && socketConnected) {
      socketRef.current.emit('send-message', {
        conversationId: activeConversation._id,
        content: newMessage.trim()
      });
      
      // Clear input
      setNewMessage('');
    } else {
      toast({
        variant: "destructive",
        title: "Connection error",
        description: "Unable to send message. Please try again."
      });
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <>
      <Helmet>
        <title>Messages | B2B Nexus</title>
        <meta name="description" content="Chat with buyers and sellers on B2B Nexus" />
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Conversation List */}
          <div className="col-span-1">
            <Card className="h-[calc(100vh-220px)]">
              <CardHeader>
                <CardTitle>Conversations</CardTitle>
                <CardDescription>Chat with your business partners</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : conversations.length > 0 ? (
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    {conversations.map((conversation) => (
                      <div 
                        key={conversation._id}
                        className={`flex items-start space-x-3 p-3 rounded-md cursor-pointer transition-colors ${
                          activeConversation?._id === conversation._id 
                            ? 'bg-blue-100 dark:bg-blue-900/20' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
                        }`}
                        onClick={() => setActiveConversation(conversation)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={conversation.participant.avatar} />
                          <AvatarFallback>
                            {conversation.participant.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className="font-medium truncate">{conversation.participant.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(conversation.lastMessage?.timestamp || conversation.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage?.content || 'No messages yet'}
                          </p>
                        </div>
                        {conversation.unreadCount > 0 && (
                          <div className="bg-blue-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
                            {conversation.unreadCount}
                          </div>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No conversations yet.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => navigate('/products')}
                    >
                      Browse Products
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Message View */}
          <div className="col-span-1 md:col-span-2">
            <Card className="h-[calc(100vh-220px)] flex flex-col">
              {activeConversation ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activeConversation.participant.avatar} />
                        <AvatarFallback>
                          {activeConversation.participant.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{activeConversation.participant.name}</CardTitle>
                        <CardDescription>{activeConversation.participant.role}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((message, index) => {
                        const isOwnMessage = message.sender._id === user.id;
                        const showAvatar = index === 0 || 
                          messages[index - 1].sender._id !== message.sender._id;
                        
                        return (
                          <div 
                            key={message._id} 
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[80%]`}
                            >
                              {!isOwnMessage && showAvatar && (
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={message.sender.avatar} />
                                  <AvatarFallback>
                                    {message.sender.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div 
                                className={`rounded-lg px-3 py-2 ${
                                  isOwnMessage 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-gray-100 dark:bg-gray-800 rounded-bl-none'
                                }`}
                              >
                                <p>{message.content}</p>
                                <div 
                                  className={`text-xs mt-1 ${
                                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                                  }`}
                                >
                                  {formatTime(message.timestamp)}
                                  {isOwnMessage && (
                                    <span className="ml-2">
                                      {message.read ? '✓✓' : '✓'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  <div className="border-t p-4">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" disabled={!newMessage.trim()}>Send</Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center flex-1 text-center p-8 text-muted-foreground">
                  <div>
                    <h3 className="font-medium text-lg mb-2">Select a conversation</h3>
                    <p>Choose a conversation from the list to start chatting</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessagesPage;