import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { CallProvider, useCall } from './context/CallContext';

import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CreateGroupModal from './components/CreateGroupModal';
import ProfileModal from './components/ProfileModal';
import IncomingCallModal from './components/IncomingCallModal';
import VideoCallModal from './components/VideoCallModal';

import { KeyRound, UserPlus, LogIn, ArrowRight } from 'lucide-react';

// Main dashboard panel (Visible once logged in)
const MainDashboard = () => {
  const { token, user } = useAuth();
  const { socket } = useSocket();

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Fetch users and groups on session setup
  useEffect(() => {
    if (!token) return;

    const fetchInitialData = async () => {
      try {
        const usersRes = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const groupsRes = await fetch('/api/groups', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          setGroups(groupsData);
        }
      } catch (err) {
        console.error('Failed to load initial workspace data:', err);
      }
    };

    fetchInitialData();
  }, [token, user?.avatarUrl]); // Refetch if profile avatar changes to sync

  // Listen to new group creations in other tabs or sync locally
  const handleGroupCreated = (newGroup) => {
    setGroups(prev => [...prev, newGroup]);
    setActiveChat({ ...newGroup, isGroup: true, isAI: false });
  };

  return (
    <div className="glass-container">
      <Sidebar 
        users={users}
        groups={groups}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        onProfileClick={() => setIsProfileModalOpen(true)}
        onCreateGroupClick={() => setIsGroupModalOpen(true)}
      />

      <ChatArea activeChat={activeChat} />

      {/* Overlays & Modals */}
      {isGroupModalOpen && (
        <CreateGroupModal 
          onClose={() => setIsGroupModalOpen(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal 
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {/* WebRTC calling systems */}
      <IncomingCallModal />
      <VideoCallModal />
    </div>
  );
};

// Authentication Screen (Sign up / Login forms)
const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, error, setError } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Both username and password are required');
      return;
    }

    setLoading(true);
    let success = false;
    if (isLogin) {
      success = await login(username.trim(), password);
    } else {
      success = await register(username.trim(), password);
    }
    setLoading(false);

    if (success) {
      setUsername('');
      setPassword('');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">InstaChat</div>
        <div className="auth-subtitle">
          {isLogin ? 'Sign in to access secure realtime workspace' : 'Create an account to start peer calls'}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input 
              id="username"
              type="text" 
              className="form-input" 
              placeholder="Username" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? 'Processing...' : isLogin ? (
              <>
                Sign In <LogIn size={18} />
              </>
            ) : (
              <>
                Register Account <UserPlus size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-switch-text">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <span 
            className="auth-switch-link"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? 'Register now' : 'Sign in here'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Router manager wrapper
const AppRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.05)',
          borderTopColor: 'hsl(var(--primary))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>Securing session context...</span>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return user ? <MainDashboard /> : <AuthScreen />;
};

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <AppRouter />
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
