import React from 'react';
import { Phone, PhoneOff, Video, Mic } from 'lucide-react';
import { useCall } from '../context/CallContext';

const IncomingCallModal = () => {
  const { incomingCall, callerInfo, callType, acceptCall, rejectCall } = useCall();

  if (!incomingCall || !callerInfo) return null;

  return (
    <div className="modal-overlay">
      <div className="incoming-call-box">
        <div className="ringing-avatar-wrapper" style={{ display: 'inline-block' }}>
          <div className="ringing-pulse"></div>
          <div className="ringing-pulse"></div>
          <div className="ringing-pulse"></div>
          <img 
            src={callerInfo.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${callerInfo.username}`} 
            alt={callerInfo.username} 
            className="ringing-avatar"
          />
        </div>
        
        <h3 className="incoming-title">{callerInfo.username}</h3>
        <p className="incoming-subtitle">
          {callType === 'video' ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Video size={16} color="hsl(var(--primary-hover))" /> Incoming Video Call...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Mic size={16} color="hsl(var(--secondary))" /> Incoming Audio Call...
            </span>
          )}
        </p>

        <div className="incoming-actions">
          <button className="btn-accept" onClick={acceptCall}>
            <Phone size={18} /> Accept
          </button>
          <button className="btn-reject" onClick={rejectCall}>
            <PhoneOff size={18} /> Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
