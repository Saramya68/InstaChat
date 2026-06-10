import React, { useState, useEffect, useRef } from 'react';
import { Send, Video, Phone, Bot, Users, ArrowDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';

const ChatArea = ({ activeChat }) => {
  const { user, token } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { startCall, callActive, calling } = useCall();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // Whether partner is typing
  const [localTyping, setLocalTyping] = useState(false); // Whether local user typing

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Helper to resolve conversation ID
  const getConversationId = () => {
    if (!activeChat || !user) return '';
    if (activeChat.isAI) return `ai_${user.id}`;
    if (activeChat.isGroup) return activeChat.id;
    
    // Sort DMs alphabetically to get a unique joint room ID
    const sorted = [user.id, activeChat.id].sort();
    return `${sorted[0]}_${sorted[1]}`;
  };

  const conversationId = getConversationId();

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch message history when conversation changes
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/${conversationId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Failed to load message history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Join room for realtime messaging signaling
    if (socket) {
      socket.emit('join-room', conversationId);
    }

    // Reset typing status on screen change
    setIsTyping(false);
  }, [conversationId, token, socket]);

  // Scroll on message updates
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 2. Setup socket listeners for messages and typing events
  useEffect(() => {
    if (!socket || !conversationId) return;

    // Receive message
    const handleMessageReceived = (msg) => {
      if (msg.conversationId === conversationId) {
        setMessages(prev => {
          // Prevent double message rendering by checking ID
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    // Typing triggers
    const handleTyping = ({ chat, senderId }) => {
      if (chat === conversationId && senderId !== user.id) {
        setIsTyping(true);
      }
    };

    const handleStopTyping = ({ chat, senderId }) => {
      if (chat === conversationId && senderId !== user.id) {
        setIsTyping(false);
      }
    };

    socket.on('message-received', handleMessageReceived);
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);

    return () => {
      socket.off('message-received', handleMessageReceived);
      socket.off('typing', handleTyping);
      socket.off('stop-typing', handleStopTyping);
    };
  }, [socket, conversationId, user]);

  // 3. Emit local typing status when composing messages
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !conversationId) return;

    if (!localTyping) {
      setLocalTyping(true);
      socket.emit('typing', { chat: conversationId, senderId: user.id });
    }

    // Debounce stop typing trigger
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { chat: conversationId, senderId: user.id });
      setLocalTyping(false);
    }, 2500);
  };

  // 4. Send Message Handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText('');

    // Stop local typing instantly
    if (socket && conversationId) {
      socket.emit('stop-typing', { chat: conversationId, senderId: user.id });
      setLocalTyping(false);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      // Save user's message
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId,
          content
        })
      });

      if (res.ok) {
        const savedMsg = await res.json();
        setMessages(prev => [...prev, savedMsg]);

        // Relay via socket if it is not AI chat
        if (!activeChat.isAI && socket) {
          socket.emit('new-message', savedMsg);
        }

        // If it is Gemini AI Bot chat
        if (activeChat.isAI) {
          setIsTyping(true); // show AI thinking status
          
          const aiRes = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              message: content,
              history: messages.slice(-5) // Send sliding window context
            })
          });

          const aiData = await aiRes.json();
          setIsTyping(false);

          if (aiRes.ok) {
            // Save AI reply in message database
            const aiSaveRes = await fetch('/api/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                conversationId,
                content: aiData.reply,
                senderId: 'gemini-bot',
                senderName: 'AI Assistant'
              })
            });

            if (aiSaveRes.ok) {
              const savedAiMsg = await aiSaveRes.json();
              setMessages(prev => [...prev, savedAiMsg]);
            }
          } else {
            console.error('Failed to get response from Gemini API');
            setIsTyping(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  if (!activeChat) {
    return (
      <div className="chat-workspace empty-chat-state">
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid hsla(var(--border-light))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Bot size={40} color="hsl(var(--text-muted))" />
        </div>
        <h2 className="empty-chat-title">Welcome to InstaChat</h2>
        <p style={{ maxWidth: '380px', fontSize: '0.9rem', color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
          Select a registered user to initiate a peer-to-peer WebRTC video/audio call, create group channels, or query the built-in Gemini assistant.
        </p>
      </div>
    );
  }

  const isOnline = !activeChat.isGroup && !activeChat.isAI && onlineUsers.includes(activeChat.id);

  return (
    <div className="chat-workspace">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          {activeChat.isAI ? (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={20} color="#fff" />
            </div>
          ) : activeChat.isGroup ? (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={20} />
            </div>
          ) : (
            <img src={activeChat.avatarUrl} alt={activeChat.username} className="avatar" />
          )}

          <div>
            <div className="chat-header-title">
              {activeChat.isAI ? 'AI Assistant' : activeChat.isGroup ? activeChat.name : activeChat.username}
            </div>
            <div className="chat-header-status">
              {activeChat.isAI 
                ? 'Powered by Google Gemini' 
                : activeChat.isGroup 
                  ? 'Group Chat Channel' 
                  : isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Media Call Actions (Only available for DMs) */}
        {!activeChat.isGroup && !activeChat.isAI && (
          <div className="chat-actions">
            <button 
              className="action-btn"
              onClick={() => startCall(activeChat, 'audio')}
              title="Voice Call"
              disabled={callActive || calling}
            >
              <Phone size={18} />
            </button>
            <button 
              className="action-btn"
              onClick={() => startCall(activeChat, 'video')}
              title="Video Call"
              disabled={callActive || calling}
            >
              <Video size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="messages-container">
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
            Retrieving chat log...
          </div>
        ) : (
          messages.map(msg => {
            // Check if sender was current logged in user
            const isSentByMe = msg.senderId === user.id;
            
            return (
              <div key={msg.id} className={`message-row ${isSentByMe ? 'sent' : 'received'}`}>
                <div className="message-bubble">
                  {!isSentByMe && activeChat.isGroup && (
                    <span className="message-sender">{msg.senderName}</span>
                  )}
                  <div>{msg.content}</div>
                  <span className="message-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Bubble */}
        {isTyping && (activeChat.isAI || isOnline) && (
          <div className="typing-indicator-wrapper">
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginRight: '4px' }}>
              {activeChat.isAI ? 'AI thinking' : 'Typing'}
            </span>
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input composer */}
      <form className="chat-input-bar" onSubmit={handleSendMessage}>
        <input 
          type="text" 
          placeholder={activeChat.isAI ? "Query Gemini assistant..." : "Compose a message..."} 
          className="chat-input"
          value={inputText}
          onChange={handleInputChange}
        />
        <button type="submit" className="btn-send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default ChatArea;
