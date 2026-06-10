import React from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff } from 'lucide-react';
import { useCall } from '../context/CallContext';

const CallControls = () => {
  const {
    callType,
    micMuted,
    camDisabled,
    screenSharing,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    endCall
  } = useCall();

  return (
    <div className="call-controls-bar">
      {/* Microphone Mute */}
      <button 
        className={`control-btn ${micMuted ? 'muted' : 'active'}`}
        onClick={toggleMute}
        title={micMuted ? "Unmute Microphone" : "Mute Microphone"}
      >
        {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>

      {/* Camera Toggle (Video Call Only) */}
      {callType === 'video' && (
        <button 
          className={`control-btn ${camDisabled ? 'muted' : 'active'}`}
          onClick={toggleCamera}
          title={camDisabled ? "Enable Video" : "Disable Video"}
        >
          {camDisabled ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
      )}

      {/* Screen Share (Video Call Only) */}
      {callType === 'video' && (
        <button 
          className={`control-btn ${screenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title={screenSharing ? "Stop Sharing Screen" : "Share Screen"}
        >
          <Monitor size={20} color={screenSharing ? "#00f0ff" : "#fff"} />
        </button>
      )}

      {/* End Call / Hang Up */}
      <button 
        className="control-btn hangup"
        onClick={endCall}
        title="Hang Up"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
};

export default CallControls;
