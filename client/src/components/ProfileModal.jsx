import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ProfileModal = ({ onClose }) => {
  const { user, updateProfile } = useAuth();
  const [avatarStyle, setAvatarStyle] = useState('adventurer');
  const [seed, setSeed] = useState(user?.username || 'avatar');
  const [saving, setSaving] = useState(false);

  const currentPreview = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(seed)}`;

  const handleRandomize = () => {
    setSeed(Math.random().toString(36).substring(7));
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await updateProfile(currentPreview);
    setSaving(false);
    if (success) {
      onClose();
    } else {
      alert('Failed to update avatar.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Edit Profile Avatar</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* Avatar Preview */}
          <div style={{ position: 'relative' }}>
            <img 
              src={currentPreview} 
              alt="Avatar Preview" 
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                border: '4px solid hsl(var(--primary))',
                background: 'rgba(255,255,255,0.05)',
                padding: '5px'
              }}
            />
            <button 
              onClick={handleRandomize}
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                background: 'hsl(var(--primary))',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
              title="Random Seed"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div style={{ width: '100%' }}>
            {/* Choose Style */}
            <div className="form-group">
              <label htmlFor="styleSelect">Avatar Style</label>
              <select 
                id="styleSelect"
                className="form-input" 
                style={{ appearance: 'none', background: 'rgba(255, 255, 255, 0.04)' }}
                value={avatarStyle}
                onChange={e => setAvatarStyle(e.target.value)}
              >
                <option value="adventurer" style={{ background: '#1c1f2a' }}>Adventurer</option>
                <option value="bottts" style={{ background: '#1c1f2a' }}>Robots</option>
                <option value="pixel-art" style={{ background: '#1c1f2a' }}>Pixel Art</option>
                <option value="lorelei" style={{ background: '#1c1f2a' }}>Lorelei</option>
                <option value="avataaars" style={{ background: '#1c1f2a' }}>Avatars</option>
              </select>
            </div>

            {/* Custom Seed Input */}
            <div className="form-group">
              <label htmlFor="seedInput">Custom Seed (Name)</label>
              <input 
                id="seedInput"
                type="text" 
                className="form-input" 
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Type anything to morph avatar..."
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
