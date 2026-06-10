const onlineUsers = new Map(); // userId -> Set of socketIds
const activeCalls = new Map(); // userId -> partnerId

// Helper to get primary socket ID for a user
function getPrimarySocketId(userId) {
  const socketIds = onlineUsers.get(userId);
  return socketIds && socketIds.size > 0 ? Array.from(socketIds)[0] : null;
}

function initializeSocket(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // 1. Setup user connection
    socket.on('setup', (userId) => {
      if (userId) {
        socket.userId = userId;
        if (!onlineUsers.has(userId)) {
          onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);
        console.log(`User ${userId} registered socket ${socket.id}. Active sockets: ${onlineUsers.get(userId).size}`);
        // Broadcast online users
        io.emit('get-online-users', Array.from(onlineUsers.keys()));
      }
    });

    // 2. Join a group chat room
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // 3. Typing events
    socket.on('typing', ({ chat, senderId }) => {
      socket.to(chat).emit('typing', { chat, senderId });
    });

    socket.on('stop-typing', ({ chat, senderId }) => {
      socket.to(chat).emit('stop-typing', { chat, senderId });
    });

    // 4. Send message relay (for real-time updates when messages are sent)
    socket.on('new-message', (message) => {
      const { conversationId, senderId } = message;
      // Emit to the room (which contains all members in a group, or is the conversationId itself)
      socket.to(conversationId).emit('message-received', message);
      
      // If it's a 1-on-1 DM, also push directly to the recipient's personal socket
      // to ensure delivery even if they haven't manually joined the conversation room.
      if (conversationId.includes('_')) {
        const parts = conversationId.split('_');
        const recipientId = parts.find(id => id !== senderId);
        if (recipientId) {
          const recipientSocketId = onlineUsers.get(recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('message-received', message);
          }
        }
      }
    });

    // 5. WebRTC Calling Signaling Events
    
    // Caller initiates call
    socket.on('call-user', ({ userToCall, signalData, from, type }) => {
      const recipientSocketId = getPrimarySocketId(userToCall);
      if (recipientSocketId) {
        console.log(`Call offer: user ${from.username} calling ${userToCall} (${type})`);
        io.to(recipientSocketId).emit('incoming-call', {
          from,
          signalData, // This is the WebRTC offer SDP
          type
        });
      } else {
        socket.emit('call-failed', { message: 'User is offline' });
      }
    });

    // Receiver accepts call
    socket.on('accept-call', ({ to, signalData }) => {
      const callerSocketId = getPrimarySocketId(to);
      if (callerSocketId) {
        console.log(`Call accepted by ${socket.userId} for ${to}`);
        // Track the active call session
        if (socket.userId) {
          activeCalls.set(socket.userId, to);
          activeCalls.set(to, socket.userId);
        }
        io.to(callerSocketId).emit('call-accepted', {
          signalData // WebRTC answer SDP
        });
      }
    });

    // Receiver rejects call
    socket.on('reject-call', ({ to }) => {
      const callerSocketId = getPrimarySocketId(to);
      if (callerSocketId) {
        console.log(`Call rejected by ${socket.userId} for ${to}`);
        io.to(callerSocketId).emit('call-rejected');
      }
    });

    // Relay WebRTC ICE candidates
    socket.on('ice-candidate', ({ to, candidate }) => {
      const peerSocketId = getPrimarySocketId(to);
      if (peerSocketId) {
        io.to(peerSocketId).emit('ice-candidate', { candidate });
      }
    });

    // Direct WebRTC SDP Offer exchange (alternative flow/renegotiation)
    socket.on('webrtc-offer', ({ to, offer }) => {
      const peerSocketId = getPrimarySocketId(to);
      if (peerSocketId) {
        io.to(peerSocketId).emit('webrtc-offer', { offer });
      }
    });

    // Direct WebRTC SDP Answer exchange (alternative flow/renegotiation)
    socket.on('webrtc-answer', ({ to, answer }) => {
      const peerSocketId = getPrimarySocketId(to);
      if (peerSocketId) {
        io.to(peerSocketId).emit('webrtc-answer', { answer });
      }
    });

    // End call manually
    socket.on('end-call', ({ to }) => {
      console.log(`Call ended by ${socket.userId || socket.id} with ${to}`);
      
      // Clear call session
      if (socket.userId) {
        activeCalls.delete(socket.userId);
        activeCalls.delete(to);
      }
      
      const peerSocketId = getPrimarySocketId(to);
      if (peerSocketId) {
        io.to(peerSocketId).emit('call-ended');
      }
    });

    // 6. Handle socket disconnect
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      
      if (socket.userId) {
        const userId = socket.userId;
        const socketIds = onlineUsers.get(userId);
        
        if (socketIds) {
          socketIds.delete(socket.id);
          if (socketIds.size === 0) {
            onlineUsers.delete(userId);
            console.log(`User ${userId} is now completely offline.`);
            // Broadcast updated online list
            io.emit('get-online-users', Array.from(onlineUsers.keys()));

            // Call signaling cleanup: if they were in an active call, notify the other peer
            if (activeCalls.has(userId)) {
              const partnerId = activeCalls.get(userId);
              const partnerSocketId = getPrimarySocketId(partnerId);
              
              if (partnerSocketId) {
                console.log(`User ${userId} disconnected during active call. Ending call for ${partnerId}`);
                io.to(partnerSocketId).emit('call-ended');
              }
              
              activeCalls.delete(userId);
              activeCalls.delete(partnerId);
            }
          } else {
            console.log(`User ${userId} disconnected one tab. Remaining tabs: ${socketIds.size}`);
          }
        }
      }
    });
  });
}

module.exports = initializeSocket;
