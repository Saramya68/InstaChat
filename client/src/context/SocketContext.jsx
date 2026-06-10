import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5000' 
      : 'https://instachat-backend-u091.onrender.com';

    const newSocket = io(socketUrl);

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket client connected:', newSocket.id);
      newSocket.emit('setup', user.id);
    });

    newSocket.on('get-online-users', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
