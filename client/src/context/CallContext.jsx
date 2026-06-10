import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth as useAuthHook } from './AuthContext';

const CallContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuthHook();

  const [callActive, setCallActive] = useState(false);
  const [calling, setCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' or 'audio'
  
  const [callerInfo, setCallerInfo] = useState(null); // Who is calling us
  const [peerInfo, setPeerInfo] = useState(null); // The other party in active call
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const [micMuted, setMicMuted] = useState(false);
  const [camDisabled, setCamDisabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const incomingCallSignalRef = useRef(null);

  // Clean up streams & connections
  const localCleanup = () => {
    console.log('Performing WebRTC local cleanup');
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (peerConnectionRef.current) {
      // Remove all event listeners before closing to prevent memory leaks
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Stop screen share tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallActive(false);
    setCalling(false);
    setIncomingCall(false);
    setCallerInfo(null);
    setPeerInfo(null);
    setMicMuted(false);
    setCamDisabled(false);
    setScreenSharing(false);
    setCallTimer(0);
    iceCandidatesQueueRef.current = [];
    incomingCallSignalRef.current = null;
  };

  // Start active call timer
  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setCallTimer(0);
    timerIntervalRef.current = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);
  };

  // Socket event binding for WebRTC signaling
  useEffect(() => {
    if (!socket) return;

    // Receive incoming call
    socket.on('incoming-call', ({ from, signalData, type }) => {
      if (callActive || calling || incomingCall) {
        // Busy - reject call automatically
        socket.emit('reject-call', { to: from.id });
        return;
      }
      console.log('Incoming call from user:', from.username);
      setIncomingCall(true);
      setCallType(type);
      setCallerInfo(from);
      setPeerInfo(from);
      incomingCallSignalRef.current = signalData;
    });

    // Call Accepted by peer
    socket.on('call-accepted', async ({ signalData }) => {
      console.log('Call accepted by peer.');
      setCalling(false);
      setCallActive(true);
      startTimer();

      try {
        if (peerConnectionRef.current) {
          const answer = new RTCSessionDescription(signalData);
          await peerConnectionRef.current.setRemoteDescription(answer);
          console.log('Remote description (SDP answer) set on caller side');

          // Process queued ICE candidates
          for (const candidate of iceCandidatesQueueRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
          iceCandidatesQueueRef.current = [];
        }
      } catch (err) {
        console.error('Error setting remote answer:', err);
        localCleanup();
      }
    });

    // Call Rejected by peer
    socket.on('call-rejected', () => {
      console.log('Call rejected by peer.');
      alert('Call rejected.');
      localCleanup();
    });

    // Remote Peer hung up or disconnected
    socket.on('call-ended', () => {
      console.log('Remote peer ended call.');
      localCleanup();
    });

    // Receive ICE candidate from peer
    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        const rtcCandidate = new RTCIceCandidate(candidate);
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(rtcCandidate);
        } else {
          iceCandidatesQueueRef.current.push(candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    // Offline / setup failure
    socket.on('call-failed', ({ message }) => {
      alert(`Call failed: ${message}`);
      localCleanup();
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('ice-candidate');
      socket.off('call-failed');
    };
  }, [socket, callActive, calling, incomingCall]);

  // Initiate call
  const startCall = async (targetUser, type) => {
    if (!socket || !user) return;
    console.log(`Initiating ${type} call to user ${targetUser.username}`);
    setCalling(true);
    setCallType(type);
    setPeerInfo(targetUser);

    try {
      // 1. Get media tracks
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: 1280, height: 720 } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Create RTCPeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add media tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // ICE Candidate gathering
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', { to: targetUser.id, candidate: event.candidate });
        }
      };

      // Remote track arrival
      pc.ontrack = (event) => {
        console.log('Received remote media stream');
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state changed:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          localCleanup();
        }
      };

      // 3. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Emit call offer to socket
      socket.emit('call-user', {
        userToCall: targetUser.id,
        signalData: offer,
        from: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
        type
      });

    } catch (err) {
      console.error('Error starting WebRTC call:', err);
      alert('Could not start call. Check camera/mic permissions.');
      localCleanup();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!socket || !user || !callerInfo || !incomingCallSignalRef.current) return;
    console.log('Accepting call from:', callerInfo.username);
    setIncomingCall(false);
    setCallActive(true);
    startTimer();

    try {
      // 1. Get local media
      const constraints = {
        audio: true,
        video: callType === 'video' ? { width: 1280, height: 720 } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', { to: callerInfo.id, candidate: event.candidate });
        }
      };

      // Remote track
      pc.ontrack = (event) => {
        console.log('Received remote media stream (receiver side)');
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state changed:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          localCleanup();
        }
      };

      // 3. Set remote description
      const offer = new RTCSessionDescription(incomingCallSignalRef.current);
      await pc.setRemoteDescription(offer);
      console.log('Remote description (SDP offer) set on receiver side');

      // Process queued ICE candidates
      for (const candidate of iceCandidatesQueueRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidatesQueueRef.current = [];

      // 4. Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 5. Emit accept-call
      socket.emit('accept-call', {
        to: callerInfo.id,
        signalData: answer
      });

    } catch (err) {
      console.error('Error accepting call:', err);
      alert('Could not accept call. Check camera/mic permissions.');
      // Reject call via socket if failed locally
      socket.emit('reject-call', { to: callerInfo.id });
      localCleanup();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (socket && callerInfo) {
      socket.emit('reject-call', { to: callerInfo.id });
    }
    localCleanup();
  };

  // Hang up active call
  const endCall = () => {
    if (socket && peerInfo) {
      socket.emit('end-call', { to: peerInfo.id });
    }
    localCleanup();
  };

  // Toggle local microphone mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle local camera disable
  const toggleCamera = () => {
    if (localStreamRef.current && callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamDisabled(!videoTrack.enabled);
      }
    }
  };

  // Screen sharing toggle
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current || callType !== 'video') return;

    try {
      if (!screenSharing) {
        // Request screen stream
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setScreenSharing(true);

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Find video sender in peer connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
        
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        // Keep local PIP updated with screen share track
        const combinedStream = new MediaStream([
          screenTrack,
          localStreamRef.current.getAudioTracks()[0]
        ]);
        setLocalStream(combinedStream);

        // Auto-revert when user clicks "Stop Sharing" in browser UI
        screenTrack.onended = async () => {
          await revertScreenShare();
        };

      } else {
        await revertScreenShare();
      }
    } catch (err) {
      console.error('Error toggling screen share:', err);
    }
  };

  const revertScreenShare = async () => {
    if (!peerConnectionRef.current || !localStreamRef.current) return;
    
    // Stop screen tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    setScreenSharing(false);

    const cameraTrack = localStreamRef.current.getVideoTracks()[0];
    const senders = peerConnectionRef.current.getSenders();
    const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');

    if (videoSender && cameraTrack) {
      await videoSender.replaceTrack(cameraTrack);
    }

    // Restore standard camera stream representation in localStream state
    setLocalStream(localStreamRef.current);
  };

  return (
    <CallContext.Provider
      value={{
        callActive,
        calling,
        incomingCall,
        callType,
        callerInfo,
        peerInfo,
        localStream,
        remoteStream,
        micMuted,
        camDisabled,
        screenSharing,
        callTimer,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleScreenShare
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
