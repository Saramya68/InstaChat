import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error('Failed to fetch users for group selection:', err);
      }
    };
    fetchUsers();
  }, [token]);

  const handleCheckboxChange = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedUsers(prev => [...prev, userId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('Please select at least one member');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName,
          memberIds: selectedUsers
        })
      });
      const data = await res.json();
      if (res.ok) {
        onGroupCreated(data);
        onClose();
      } else {
        setError(data.message || 'Failed to create group');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Create Group Chat</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="groupName">Group Name</label>
            <input 
              id="groupName"
              type="text" 
              className="form-input" 
              placeholder="e.g. Design Team 🎨" 
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Select Members</label>
            <div className="checkbox-list">
              {users.map(u => (
                <label key={u.id} className="checkbox-item">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => handleCheckboxChange(u.id)}
                    disabled={loading}
                  />
                  <img src={u.avatarUrl} alt={u.username} style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                  <span style={{ fontSize: '0.9rem' }}>{u.username}</span>
                </label>
              ))}
              {users.length === 0 && (
                <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', padding: '10px', textAlign: 'center' }}>
                  No other registered users found
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
