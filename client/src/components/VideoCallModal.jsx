import React, { useEffect, useRef } from 'react';
import { PhoneOff, Video, VideoOff, MicOff, Monitor } from 'lucide-react';
import { useCall } from '../context/CallContext';
import CallControls from './CallControls';

const VideoCallModal = () => {
  const {
    callActive,
    calling,
    callType,
    peerInfo,
    localStream,
    remoteStream,
    micMuted,
    camDisabled,
    screenSharing,
    callTimer,
    endCall
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Set local stream srcObject
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote stream srcObject
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Format call timer (seconds -> mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!callActive && !calling) return null;

  return (
    <div className="call-modal">
      {/* Call Header */}
      <div className="call-header">
        <div className="call-timer">
          {callActive ? formatTime(callTimer) : 'Connecting...'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {micMuted && <MicOff size={16} color="hsl(var(--danger))" />}
          {camDisabled && <VideoOff size={16} color="hsl(var(--danger))" />}
          {screenSharing && <Monitor size={16} color="hsl(var(--secondary))" />}
          <span style={{ fontWeight: 600 }}>{peerInfo?.username}</span>
        </div>
      </div>

      {/* Video Workspace */}
      <div className="video-grid">
        {/* Outgoing Calling Ringing State */}
        {calling && (
          <div className="calling-overlay">
            <div className="ringing-avatar-wrapper">
              <div className="ringing-pulse"></div>
              <div className="ringing-pulse"></div>
              <div className="ringing-pulse"></div>
              <img 
                src={peerInfo?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${peerInfo?.username}`} 
                alt={peerInfo?.username} 
                className="ringing-avatar"
              />
            </div>
            <h3 className="calling-text">{peerInfo?.username}</h3>
            <p className="calling-sub">Calling ({callType === 'video' ? 'Video' : 'Audio'})...</p>

            <button 
              className="control-btn hangup" 
              onClick={endCall} 
              style={{ marginTop: '40px' }}
              title="Cancel Call"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        )}

        {/* Connected Call State */}
        {callActive && (
          <>
            {callType === 'video' ? (
              <>
                {/* Fullscreen Remote Video */}
                {remoteStream ? (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="remote-video"
                  />
                ) : (
                  <div className="calling-overlay">
                    <img 
                      src={peerInfo?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${peerInfo?.username}`} 
                      alt={peerInfo?.username} 
                      className="ringing-avatar"
                      style={{ border: '2px solid rgba(255,255,255,0.1)', boxShadow: 'none' }}
                    />
                    <p style={{ marginTop: '15px', color: 'hsl(var(--text-muted))' }}>
                      Waiting for video stream...
                    </p>
                  </div>
                )}

                {/* Draggable PIP Local Video */}
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted // Always mute local video playback in UI to prevent audio feedback loop
                  className={`local-video-pip ${screenSharing ? 'sharing' : ''}`}
                  style={{ display: camDisabled ? 'none' : 'block' }}
                />

                {camDisabled && (
                  <div className="local-video-pip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                    <VideoOff size={24} color="rgba(255,255,255,0.3)" />
                  </div>
                )}
              </>
            ) : (
              /* Connected Audio-Only View */
              <div className="calling-overlay">
                <img 
                  src={peerInfo?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${peerInfo?.username}`} 
                  alt={peerInfo?.username} 
                  className="ringing-avatar"
                  style={{ 
                    border: '3px solid hsl(var(--secondary))', 
                    boxShadow: '0 0 30px hsla(var(--secondary), 0.2)',
                    animation: 'none' 
                  }}
                />
                <h3 className="calling-text" style={{ marginTop: '20px' }}>{peerInfo?.username}</h3>
                <p style={{ color: 'hsl(var(--success))', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--success))', display: 'inline-block' }}></span>
                  Voice Connected
                </p>
              </div>
            )}

            {/* Bottom Controls Overlay */}
            <CallControls />
          </>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;
