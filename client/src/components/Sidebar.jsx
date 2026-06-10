import React, { useState } from 'react';
import { Search, Plus, LogOut, Bot, Users, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Sidebar = ({
  users,
  groups,
  activeChat,
  setActiveChat,
  onProfileClick,
  onCreateGroupClick
}) => {
  const { user, logout } = useAuth();
  const { onlineUsers } = useSocket();
  const [search, setSearch] = useState('');

  // Fixed AI Bot target
  const aiBotChat = {
    id: 'gemini-bot',
    username: 'AI Assistant',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=GeminiAI',
    isAI: true
  };

  // Filters based on search query
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const isAiSelected = activeChat && activeChat.isAI;

  return (
    <div className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="user-profile-btn" onClick={onProfileClick} title="Edit Profile Avatar">
          <img 
            src={user?.avatarUrl} 
            alt={user?.username} 
            className="avatar"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{user?.username}</span>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <User size={10} /> Profile settings
            </span>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="sidebar-search">
        <Search size={16} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search chats..." 
          className="search-input" 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Sidebar List Sections */}
      <div className="sidebar-sections">
        {/* 1. AI Pinned Bot Section */}
        <div className="section-label">AI Assistant</div>
        <div 
          className={`list-item ${isAiSelected ? 'active' : ''}`}
          onClick={() => setActiveChat(aiBotChat)}
        >
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid hsla(var(--border-light))'
            }}>
              <Bot size={20} color="#fff" />
            </div>
            <div className="status-badge online" style={{ left: '32px', bottom: '2px' }}></div>
          </div>
          <div className="list-item-content">
            <div className="list-item-name">
              <span>AI Assistant</span>
              <span style={{
                fontSize: '0.65rem',
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 6px',
                borderRadius: '8px',
                fontWeight: 700
              }}>GEMINI</span>
            </div>
            <div className="list-item-sub">Ask me anything in real-time...</div>
          </div>
        </div>

        {/* 2. Direct Messages Section */}
        <div className="section-label" style={{ marginTop: '15px' }}>Direct Messages</div>
        {filteredUsers.map(u => {
          const isOnline = onlineUsers.includes(u.id);
          const isSelected = activeChat && !activeChat.isGroup && !activeChat.isAI && activeChat.id === u.id;
          
          return (
            <div 
              key={u.id}
              className={`list-item ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveChat({ ...u, isGroup: false, isAI: false })}
            >
              <img src={u.avatarUrl} alt={u.username} className="avatar" />
              <div className={`status-badge ${isOnline ? 'online' : ''}`} />
              <div className="list-item-content">
                <div className="list-item-name">{u.username}</div>
                <div className="list-item-sub">
                  {isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          );
        })}
        {filteredUsers.length === 0 && (
          <div style={{ padding: '10px 20px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            No users found
          </div>
        )}

        {/* 3. Group Channels Section */}
        <div className="section-label" style={{ marginTop: '15px' }}>
          <span>Group Chats</span>
          <Plus size={16} className="add-group-btn" onClick={onCreateGroupClick} title="Create Group" />
        </div>
        {filteredGroups.map(g => {
          const isSelected = activeChat && activeChat.isGroup && activeChat.id === g.id;
          
          return (
            <div 
              key={g.id}
              className={`list-item ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveChat({ ...g, isGroup: true, isAI: false })}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid hsla(var(--border-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={18} color="hsl(var(--text-muted))" />
              </div>
              <div className="list-item-content">
                <div className="list-item-name">{g.name}</div>
                <div className="list-item-sub">{g.memberIds.length} members</div>
              </div>
            </div>
          );
        })}
        {filteredGroups.length === 0 && (
          <div style={{ padding: '10px 20px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            No groups joined
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>InstaChat Workspace</span>
          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Secure P2P Signaling</span>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
