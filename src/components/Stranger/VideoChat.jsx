import React, { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactPlayer from "react-player";
import peer from "../../service/peer";
import { useSocket } from "../../context/SoketProvider";

const StrangerVideoChat = () => {
  const socketData = useSocket();
  const navigate = useNavigate();
  
  // Destructure socket and connection status
  const socket = socketData?.socket;
  const isSocketConnected = socketData?.isConnected;
  const findStranger = socketData?.findStranger;
  
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    searching: false,
    errorMessage: null,
    reconnectAttempts: 0
  });
  
  const [streams, setStreams] = useState({
    local: null,
    remote: null
  });
  
  const [mediaState, setMediaState] = useState({
    audio: true,
    video: true
  });
  
  const [chatState, setChatState] = useState({
    isOpen: false,
    messages: [],
    draft: ""
  });
  
  // References
  const myStreamRef = useRef(null);
  const remotePeerIdRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatState.messages]);

  // Initialize local stream with error handling and retry logic
  const initializeStream = useCallback(async () => {
    try {
      // Clean up any existing stream
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      console.log('Local stream obtained:', stream.id);
      setStreams(prev => ({ ...prev, local: stream }));
      myStreamRef.current = stream;
      
      // Set initial audio/video state based on tracks
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      
      setMediaState({
        audio: audioTrack ? audioTrack.enabled : true,
        video: videoTrack ? videoTrack.enabled : true
      });
      
      setConnectionState(prev => ({
        ...prev,
        errorMessage: null,
        reconnectAttempts: 0
      }));
      
      return true;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      
      // Handle specific permission errors
      if (error.name === "NotAllowedError") {
        setConnectionState(prev => ({
          ...prev,
          errorMessage: "Camera and microphone access denied. Please allow permissions and refresh."
        }));
      } else if (error.name === "NotFoundError") {
        setConnectionState(prev => ({
          ...prev,
          errorMessage: "No camera or microphone found. Please connect a device and try again."
        }));
      } else {
        setConnectionState(prev => ({
          ...prev,
          errorMessage: "Failed to access camera or microphone. Please check your devices."
        }));
      }
      
      // Auto-retry with backoff
      const attempts = connectionState.reconnectAttempts + 1;
      if (attempts < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        console.log(`Retrying media initialization in ${delay}ms (attempt ${attempts})`);
        
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          setConnectionState(prev => ({
            ...prev,
            reconnectAttempts: attempts
          }));
          initializeStream();
        }, delay);
      }
      
      return false;
    }
  }, [connectionState.reconnectAttempts]);

  // Find a stranger to connect with
  const findStrangerToConnect = useCallback(async () => {
    if (!socket || !isSocketConnected) {
      setConnectionState(prev => ({
        ...prev,
        errorMessage: "Socket not connected. Please wait or refresh the page."
      }));
      return;
    }
    
    // Check if we have media permissions first
    if (!myStreamRef.current) {
      console.log("Local stream not ready, initializing before finding stranger");
      const success = await initializeStream();
      if (!success) return; // Don't proceed if media initialization failed
    }
    
    console.log("Finding a stranger to connect with");
    setConnectionState(prev => ({
      ...prev,
      searching: true,
      isConnected: false,
      errorMessage: null
    }));
    
    setStreams(prev => ({ ...prev, remote: null }));
    setChatState(prev => ({ ...prev, messages: [] }));
    
    // Clear any existing peer connections
    if (remotePeerIdRef.current) {
      peer.removePeer(remotePeerIdRef.current);
      remotePeerIdRef.current = null;
    }
    
    // Use the socket provider's findStranger if available, otherwise direct emit
    if (typeof findStranger === 'function') {
      findStranger({ type: 'video' });
    } else if (socket) {
      socket.emit("stranger:find");
    }
  }, [socket, isSocketConnected, initializeStream, findStranger]);

  // Handle connection to a stranger
  const handleStrangerConnected = useCallback(({ strangerId }) => {
    console.log("Connected to stranger:", strangerId);
    remotePeerIdRef.current = strangerId;
    
    setConnectionState(prev => ({
      ...prev,
      isConnected: true,
      searching: false,
      errorMessage: null
    }));
    
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, { text: "Connected to a stranger", sender: "system", timestamp: Date.now() }]
    }));
    
    // Set up peer connection monitoring
    peer.setStateChangeListener(strangerId, (state) => {
      console.log(`Connection state with stranger changed: ${state}`);
      if (state === 'disconnected' || state === 'failed') {
        handleConnectionIssue();
      }
    });
    
    // Set up stream listener for this peer
    peer.setStreamListener(strangerId, (stream) => {
      console.log("Received remote stream:", stream.id);
      setStreams(prev => ({ ...prev, remote: stream }));
    });
    
    // Call the stranger
    callUser(strangerId);
  }, []);

  // Handle connection issues
  const handleConnectionIssue = useCallback(() => {
    const peerId = remotePeerIdRef.current;
    if (!peerId) return;
    
    const remotePeer = peer.getPeer(peerId);
    if (!remotePeer || 
       (remotePeer.connectionState !== 'connected' && 
        remotePeer.iceConnectionState !== 'connected')) {
      
      console.log("Connection issue detected, attempting recovery");
      
      // Add a connection issue message
      setChatState(prev => ({
        ...prev, 
        messages: [...prev.messages, { 
          text: "Connection issues detected. Trying to reconnect...", 
          sender: "system",
          timestamp: Date.now()
        }]
      }));
      
      // Try to renegotiate
      callUser(peerId);
      
      // Set a timeout to check if recovery worked
      setTimeout(() => {
        const currentPeer = peer.getPeer(peerId);
        if (!currentPeer || 
           (currentPeer.connectionState !== 'connected' && 
            currentPeer.iceConnectionState !== 'connected')) {
          
          // If still not connected, show disconnect message
          setChatState(prev => ({
            ...prev, 
            messages: [...prev.messages, { 
              text: "Connection lost. You can try skipping to find a new stranger.", 
              sender: "system",
              timestamp: Date.now()
            }]
          }));
        }
      }, 8000);
    }
  }, []);

  // Call a user
  const callUser = useCallback(async (userId) => {
    try {
      if (!myStreamRef.current) {
        console.error("Local stream not available when trying to call");
        return;
      }
      
      console.log("Calling user:", userId);
      
      // Add tracks to the peer connection
      peer.addTracks(userId, myStreamRef.current);
      
      // Create and send offer
      const offer = await peer.getOffer(userId);
      if (socket && isSocketConnected) {
        socket.emit("user:call", { to: userId, offer });
      }
    } catch (error) {
      console.error("Error calling user:", error);
      setConnectionState(prev => ({
        ...prev,
        errorMessage: "Failed to establish call. Please try skipping to another stranger."
      }));
    }
  }, [socket, isSocketConnected]);

  // Handle incoming call
  const handleIncomingCall = useCallback(async ({ from, offer }) => {
    try {
      console.log("Received call from:", from);
      
      // Make sure we have a local stream
      if (!myStreamRef.current) {
        console.log("Local stream not ready when receiving call, initializing");
        await initializeStream();
      }
      
      // Set up stream listener for this peer
      peer.setStreamListener(from, (stream) => {
        console.log("Received remote stream from incoming call:", stream.id);
        setStreams(prev => ({ ...prev, remote: stream }));
      });
      
      // Add our tracks to the peer connection
      peer.addTracks(from, myStreamRef.current);
      
      // Create and send answer
      const ans = await peer.getAnswer(from, offer);
      if (socket && isSocketConnected) {
        socket.emit("call:accepted", { to: from, ans });
      }
      
      // Update peer reference
      remotePeerIdRef.current = from;
    } catch (error) {
      console.error("Error handling incoming call:", error);
      setConnectionState(prev => ({
        ...prev,
        errorMessage: "Failed to answer call. Please try skipping to another stranger."
      }));
    }
  }, [socket, isSocketConnected, initializeStream]);

  // Handle call accepted
  const handleCallAccepted = useCallback(async ({ from, ans }) => {
    try {
      console.log("Call accepted by:", from);
      await peer.setRemoteDescription(from, ans);
    } catch (error) {
      console.error("Error handling call accepted:", error);
    }
  }, []);

  // Handle negotiation needed
  const handleNegotiationNeeded = useCallback(async (userId) => {
    try {
      console.log("Negotiation needed for:", userId);
      const offer = await peer.getOffer(userId);
      if (socket && isSocketConnected) {
        socket.emit("peer:nego:needed", { offer, to: userId });
      }
    } catch (error) {
      console.error("Error during negotiation:", error);
    }
  }, [socket, isSocketConnected]);

  // Handle incoming negotiation
  const handleNegotiationIncoming = useCallback(async ({ from, offer }) => {
    try {
      console.log("Negotiation incoming from:", from);
      const ans = await peer.getAnswer(from, offer);
      if (socket && isSocketConnected) {
        socket.emit("peer:nego:done", { to: from, ans });
      }
    } catch (error) {
      console.error("Error handling negotiation:", error);
    }
  }, [socket, isSocketConnected]);

  // Handle final negotiation
  const handleNegotiationFinal = useCallback(async ({ from, ans }) => {
    try {
      console.log("Final negotiation from:", from);
      await peer.setRemoteDescription(from, ans);
    } catch (error) {
      console.error("Error handling final negotiation:", error);
    }
  }, []);

  // Handle ICE candidate exchange
  const handleIceCandidate = useCallback(async ({ from, candidate }) => {
    try {
      console.log("Received ICE candidate from:", from);
      await peer.addIceCandidate(from, candidate);
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }, []);

  // Handle stranger disconnected
  const handleStrangerDisconnected = useCallback(() => {
    console.log("Stranger disconnected");
    
    setConnectionState(prev => ({
      ...prev,
      isConnected: false
    }));
    
    setStreams(prev => ({ ...prev, remote: null }));
    
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, { 
        text: "Stranger disconnected", 
        sender: "system",
        timestamp: Date.now()
      }]
    }));
    
    // Cleanup peer connection
    if (remotePeerIdRef.current) {
      peer.removePeer(remotePeerIdRef.current);
      remotePeerIdRef.current = null;
    }
  }, []);

  // Skip current stranger and find a new one
  const handleSkip = useCallback(() => {
    if (connectionState.searching) return;
    
    console.log("Skipping to next stranger");
    
    // Notify the current stranger if connected
    if (remotePeerIdRef.current && socket && isSocketConnected) {
      socket.emit("stranger:skip", { strangerId: remotePeerIdRef.current });
      peer.removePeer(remotePeerIdRef.current);
      remotePeerIdRef.current = null;
    }
    
    findStrangerToConnect();
  }, [socket, isSocketConnected, findStrangerToConnect, connectionState.searching]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (streams.local) {
      const audioTracks = streams.local.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = enabled;
        setMediaState(prev => ({ ...prev, audio: enabled }));
      }
    }
  }, [streams.local]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (streams.local) {
      const videoTracks = streams.local.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = enabled;
        setMediaState(prev => ({ ...prev, video: enabled }));
      }
    }
  }, [streams.local]);

  // Toggle chat panel
  const toggleChat = useCallback(() => {
    setChatState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Close the chat
  const handleClose = useCallback(() => {
    if (window.confirm("Are you sure you want to end the call?")) {
      // Notify the stranger if connected
      if (remotePeerIdRef.current && socket && isSocketConnected) {
        socket.emit("stranger:disconnect", { strangerId: remotePeerIdRef.current });
        peer.removePeer(remotePeerIdRef.current);
      }
      
      // Stop local stream
      if (streams.local) {
        streams.local.getTracks().forEach(track => track.stop());
      }
      
      // Clear timeouts
      clearTimeout(reconnectTimerRef.current);
      
      // Navigate away
      navigate("/");
    }
  }, [socket, isSocketConnected, streams.local, navigate]);

  // Send chat message
  const handleSendMessage = useCallback((e) => {
    e?.preventDefault();
    
    if (!chatState.draft.trim() || !connectionState.isConnected || !remotePeerIdRef.current) return;
    
    // Add message to local state
    const message = { 
      text: chatState.draft, 
      sender: "me",
      timestamp: Date.now()
    };
    
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      draft: ""
    }));
    
    // Send to stranger if connected
    if (socket && isSocketConnected && remotePeerIdRef.current) {
      socket.emit("stranger:message", { 
        to: remotePeerIdRef.current, 
        message: chatState.draft 
      });
    }
  }, [chatState.draft, connectionState.isConnected, socket, isSocketConnected]);

  // Handle incoming message
  const handleIncomingMessage = useCallback(({ from, message }) => {
    setChatState(prev => ({
      ...prev, 
      messages: [...prev.messages, { 
        text: message, 
        sender: "stranger",
        timestamp: Date.now()
      }]
    }));
    
    // If chat is closed, show a notification
    if (!chatState.isOpen) {
      // You could implement a notification UI here
      console.log("New message received while chat is closed");
      // Example: flash the chat button or show a badge
    }
  }, [chatState.isOpen]);

  // Initialize when component mounts
  useEffect(() => {
    initializeStream();
    
    return () => {
      // Cleanup on unmount
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (remotePeerIdRef.current) {
        peer.removePeer(remotePeerIdRef.current);
      }
      
      clearTimeout(reconnectTimerRef.current);
    };
  }, [initializeStream]);

  // Start finding strangers when socket connects
  useEffect(() => {
    if (isSocketConnected && myStreamRef.current && 
        !connectionState.searching && !connectionState.isConnected) {
      console.log("Socket connected, starting to find strangers");
      findStrangerToConnect();
    }
  }, [isSocketConnected, findStrangerToConnect, connectionState]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("stranger:connected", handleStrangerConnected);
    socket.on("stranger:disconnected", handleStrangerDisconnected);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegotiationIncoming);
    socket.on("peer:nego:final", handleNegotiationFinal);
    socket.on("ice:candidate", handleIceCandidate);
    socket.on("stranger:message", handleIncomingMessage);

    return () => {
      socket.off("stranger:connected", handleStrangerConnected);
      socket.off("stranger:disconnected", handleStrangerDisconnected);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegotiationIncoming);
      socket.off("peer:nego:final", handleNegotiationFinal);
      socket.off("ice:candidate", handleIceCandidate);
      socket.off("stranger:message", handleIncomingMessage);
    };
  }, [
    socket,
    handleStrangerConnected,
    handleStrangerDisconnected,
    handleIncomingCall,
    handleCallAccepted,
    handleNegotiationIncoming,
    handleNegotiationFinal,
    handleIceCandidate,
    handleIncomingMessage,
  ]);

  // Set up negotiation event listener for remote peer
  useEffect(() => {
    if (!remotePeerIdRef.current) return;
    
    const remotePeer = peer.getPeer(remotePeerIdRef.current);
    if (remotePeer) {
      const handleNegotiation = () => {
        handleNegotiationNeeded(remotePeerIdRef.current);
      };
      
      remotePeer.addEventListener("negotiationneeded", handleNegotiation);
      
      return () => {
        remotePeer.removeEventListener("negotiationneeded", handleNegotiation);
      };
    }
  }, [remotePeerIdRef.current, handleNegotiationNeeded]);

  // Format timestamp for chat messages
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Render video participant
  const renderParticipant = (stream, isLocal = false) => {
    const participantName = isLocal ? "You" : "Stranger";
    const initial = isLocal ? "Y" : "S";
    const bgColor = isLocal ? "bg-blue-500" : "bg-purple-500";
    
    // Determine if video is enabled
    const isVideoEnabled = isLocal ? mediaState.video : true;
    
    return (
      <div className="relative w-full h-full bg-gray-800 rounded-lg overflow-hidden">
        {stream && isVideoEnabled ? (
          <ReactPlayer
            playing
            muted={isLocal}
            width="100%"
            height="100%"
            url={stream}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              minWidth: '100%',
              minHeight: '100%',
              objectFit: 'cover'
            }}
            config={{
              file: {
                attributes: {
                  playsInline: true 
                }
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex items-center justify-center w-32 h-32 text-white ${bgColor} rounded-full`}>
              <span className="text-4xl">{initial}</span>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 mr-2 text-white ${bgColor} rounded-full`}>
                {initial}
              </div>
              <span className="text-sm text-white">{participantName}</span>
            </div>
            {isLocal && (
              <div className="flex items-center space-x-2">
                {!mediaState.audio && (
                  <div className="p-1 bg-red-500 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 9l4.95-4.95a7 7 0 00-9.9 0zM10 11l-4.95 4.95a7 7 0 009.9-9.9L10 11z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {!mediaState.video && (
                  <div className="p-1 bg-red-500 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render notification for connection errors
  const renderErrorNotification = () => {
    if (!connectionState.errorMessage) return null;
    
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span>{connectionState.errorMessage}</span>
        <button 
          onClick={() => setConnectionState(prev => ({ ...prev, errorMessage: null }))}
          className="ml-2 text-white"
        >
          ×
        </button>
      </div>
    );
  };

  // Get new message indicators for chat toggle button
  const getUnreadCount = () => {
    if (chatState.isOpen) return 0;
    
    return chatState.messages.filter(msg => 
      msg.sender === "stranger" && 
      msg.timestamp > (chatState.lastViewedTimestamp || 0)
    ).length;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 text-white">
        <h1 className="text-xl font-bold text-green-200">Stranger Video Chat</h1>
        <div className="flex items-center space-x-2">
          <span className={`inline-block w-3 h-3 rounded-full ${isSocketConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
          <span className="text-sm text-gray-300">{isSocketConnected ? 'Connected' : 'Disconnected'}</span>
          <button 
            onClick={handleClose}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold ml-4"
          >
            End Call
          </button>
        </div>
      </div>

      {/* Error notification */}
      {renderErrorNotification()}

      {/* Main content area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="relative h-full p-4 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* My video */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              {renderParticipant(streams.local, true)}
            </div>

            {/* Stranger video */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              {connectionState.searching ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-200 mb-4"></div>
                  <p className="text-green-200 font-medium">Finding someone to chat with...</p>
                </div>
              ) : (
                renderParticipant(streams.remote)
              )}
            </div>
          </div>
        </div>
        
        {/* <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`px-8 py-3 rounded-full font-semibold flex items-center ${
            isChatOpen ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {isChatOpen ? 'Hide Chat' : 'Show Chat'}
        </button> */}
      </div>
    </div>
  );
};

export default StrangerVideoChat;