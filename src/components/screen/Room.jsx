import React, { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactPlayer from "react-player";
import peer from "../../service/peer";
import { useSocket } from "../../context/SoketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [myStream, setMyStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeParticipant, setActiveParticipant] = useState(null);
  const [screenLayout, setScreenLayout] = useState("grid"); // grid, spotlight
  const myStreamRef = useRef(null);
  const gridContainerRef = useRef(null);

  // Handle user joining the room
  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`User ${email} (${id}) joined the room`);
    setUsers((prev) => [...prev, { id, email }]);
  }, []);

  // Handle user leaving the room
  const handleUserLeft = useCallback(({ id }) => {
    console.log(`User ${id} left the room`);
    setUsers((prev) => prev.filter(user => user.id !== id));
    setRemoteStreams((prev) => {
      const newStreams = { ...prev };
      delete newStreams[id];
      return newStreams;
    });
    peer.removePeer(id);
  }, []);

  // Handle existing users in the room
  const handleExistingUsers = useCallback((usersInRoom) => {
    console.log("Existing users in room:", usersInRoom);
    setUsers(usersInRoom);
  }, []);

  // Initialize local stream
  const initializeStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      myStreamRef.current = stream;
      
      // Call all existing users in the room
      users.forEach(user => {
        callUser(user.id);
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  }, [users]);

  // Call a user
  const callUser = useCallback(async (userId) => {
    try {
      if (!myStreamRef.current) return;
      
      const offer = await peer.getOffer(userId);
      socket.emit("user:call", { to: userId, offer });
      
      // Add tracks to the peer connection
      peer.addTracks(userId, myStreamRef.current);
    } catch (error) {
      console.error("Error calling user:", error);
    }
  }, [socket]);

  // Handle incoming call
  const handleIncomingCall = useCallback(async ({ from, offer }) => {
    try {
      // If we don't have our stream yet, get it
      if (!myStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        myStreamRef.current = stream;
      }
      
      const ans = await peer.getAnswer(from, offer);
      socket.emit("call:accepted", { to: from, ans });
      
      // Add tracks to the peer connection
      peer.addTracks(from, myStreamRef.current);
      
      // Set up track event handler for this peer
      const remotePeer = peer.getPeer(from);
      remotePeer.ontrack = ({ streams }) => {
        if (streams[0]) {
          setRemoteStreams(prev => ({
            ...prev,
            [from]: streams[0]
          }));
        }
      };
    } catch (error) {
      console.error("Error handling incoming call:", error);
    }
  }, [socket]);

  // Handle call accepted
  const handleCallAccepted = useCallback(async ({ from, ans }) => {
    try {
      await peer.setRemoteDescription(from, ans);
      console.log("Call accepted by:", from);
      
      // Set up track event handler if not already done
      const remotePeer = peer.getPeer(from);
      remotePeer.ontrack = ({ streams }) => {
        if (streams[0]) {
          setRemoteStreams(prev => ({
            ...prev,
            [from]: streams[0]
          }));
        }
      };
    } catch (error) {
      console.error("Error handling call accepted:", error);
    }
  }, []);

  // Handle negotiation needed
  const handleNegotiationNeeded = useCallback(async (userId) => {
    try {
      const offer = await peer.getOffer(userId);
      socket.emit("peer:nego:needed", { offer, to: userId });
    } catch (error) {
      console.error("Error during negotiation:", error);
    }
  }, [socket]);

  // Handle incoming negotiation
  const handleNegotiationIncoming = useCallback(async ({ from, offer }) => {
    try {
      const ans = await peer.getAnswer(from, offer);
      socket.emit("peer:nego:done", { to: from, ans });
    } catch (error) {
      console.error("Error handling negotiation:", error);
    }
  }, [socket]);

  // Handle final negotiation
  const handleNegotiationFinal = useCallback(async ({ from, ans }) => {
    try {
      await peer.setRemoteDescription(from, ans);
    } catch (error) {
      console.error("Error handling final negotiation:", error);
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (myStream) {
      myStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(prev => !prev);
    }
  }, [myStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (myStream) {
      myStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(prev => !prev);
    }
  }, [myStream]);

  // Toggle participants panel
  const toggleParticipants = useCallback(() => {
    setShowParticipants(prev => !prev);
  }, []);

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    // Stop local stream
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    users.forEach(user => {
      peer.removePeer(user.id);
    });
    
    // Navigate back to lobby
    navigate("/");
  }, [myStream, users, navigate]);

  // Toggle layout between grid and spotlight
  const toggleLayout = useCallback(() => {
    setScreenLayout(prev => (prev === "grid" ? "spotlight" : "grid"));
  }, []);

  // Set active participant for spotlight view
  const setAsActive = useCallback((id) => {
    setActiveParticipant(id);
    if (screenLayout === "grid") {
      setScreenLayout("spotlight");
    }
  }, [screenLayout]);

  // Toggle fullscreen
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      gridContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  }, []);

  // Format meeting time
  const formatMeetingTime = () => {
    const hours = Math.floor(meetingTime / 3600);
    const minutes = Math.floor((meetingTime % 3600) / 60);
    const seconds = meetingTime % 60;
    
    const formattedHours = hours > 0 ? `${hours}:` : '';
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    
    return `${formattedHours}${formattedMinutes}:${formattedSeconds}`;
  };

  // Initialize when component mounts
  useEffect(() => {
    initializeStream();
  }, [initializeStream]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("room:users", handleExistingUsers);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegotiationIncoming);
    socket.on("peer:nego:final", handleNegotiationFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("room:users", handleExistingUsers);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegotiationIncoming);
      socket.off("peer:nego:final", handleNegotiationFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleUserLeft,
    handleExistingUsers,
    handleIncomingCall,
    handleCallAccepted,
    handleNegotiationIncoming,
    handleNegotiationFinal,
  ]);

  // Set up negotiation event listeners for each peer
  useEffect(() => {
    users.forEach(user => {
      const remotePeer = peer.getPeer(user.id);
      if (remotePeer) {
        const handleNegotiation = () => {
          handleNegotiationNeeded(user.id);
        };
        
        remotePeer.addEventListener("negotiationneeded", handleNegotiation);
        
        return () => {
          remotePeer.removeEventListener("negotiationneeded", handleNegotiation);
        };
      }
    });
  }, [users, handleNegotiationNeeded]);

  // Meeting timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setMeetingTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Calculate grid layout based on number of participants
  const getGridClass = () => {
    const totalParticipants = 1 + Object.keys(remoteStreams).length;
    
    if (totalParticipants === 1) {
      return "grid-cols-1";
    } else if (totalParticipants === 2) {
      return "grid-cols-2";
    } else if (totalParticipants <= 4) {
      return "grid-cols-2";
    } else if (totalParticipants <= 9) {
      return "grid-cols-3";
    } else {
      return "grid-cols-4";
    }
  };

  // Calculate dynamic grid item size based on participant count
  const getGridItemClass = () => {
    const totalParticipants = 1 + Object.keys(remoteStreams).length;
    
    if (totalParticipants <= 2) {
      return "h-full";
    } else if (totalParticipants <= 4) {
      return "h-1/2";
    } else if (totalParticipants <= 9) {
      return "h-1/3";
    } else {
      return "h-1/4";
    }
  };

  // Render video participant
  const renderParticipant = (stream, isLocal = false, userId = null, user = null) => {
    const participantName = isLocal 
      ? "You" 
      : (user ? user.email : "Participant");
    
    const initial = isLocal 
      ? (socket.id ? socket.id[0].toUpperCase() : "Y") 
      : (user?.email?.[0]?.toUpperCase() || "P");
    
    const bgColor = isLocal ? "bg-blue-500" : "bg-purple-500";
    
    const isActive = screenLayout === "spotlight" && 
      ((isLocal && activeParticipant === "local") || 
      (!isLocal && activeParticipant === userId));
    
    const handleClick = () => {
      if (!isActive) {
        setAsActive(isLocal ? "local" : userId);
      }
    };
    
    const containerClass = `relative overflow-hidden bg-gray-800 rounded-lg shadow-lg ${
      screenLayout === "grid" 
        ? "aspect-video w-full" 
        : isActive 
          ? "aspect-video w-full h-full" 
          : "w-24 h-24 rounded-lg overflow-hidden"
    }`;
    return (
      <div className="relative w-full h-full bg-gray-800 rounded-lg overflow-hidden">
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
        <div className="absolute bottom-0 left-0 right-0 px-2 sm:px-4 py-1 sm:py-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 mr-2 text-white ${bgColor} rounded-full`}>
                <span className="text-xs sm:text-sm">{initial}</span>
              </div>
              <span className="text-xs sm:text-sm text-white truncate max-w-[100px] sm:max-w-[150px]">{participantName}</span>
            </div>
            {isLocal && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                {!audioEnabled && (
                  <div className="p-1 bg-red-500 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 9l4.95-4.95a7 7 0 00-9.9 0zM10 11l-4.95 4.95a7 7 0 009.9-9.9L10 11z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {!videoEnabled && (
                  <div className="p-1 bg-red-500 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
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
  }
    return (
      <div className="flex flex-col h-screen bg-gray-900">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-2 sm:p-3 bg-gray-800 text-white">
          <div className="flex items-center mb-2 sm:mb-0">
            <h1 className="text-sm sm:text-lg font-medium truncate max-w-[200px] sm:max-w-none">Meeting • {roomId}</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="text-xs sm:text-sm">{formatMeetingTime()}</div>
            <div className="flex items-center px-2 py-1 sm:px-3 sm:py-1 bg-gray-700 rounded-full">
              <span className="w-2 h-2 mr-1 sm:mr-2 bg-green-500 rounded-full"></span>
              <span className="text-xs sm:text-sm">{users.length + 1} participant{users.length !== 0 ? "s" : ""}</span>
            </div>
          </div>
        </div>
    
        {/* Main content area */}
        <div className="relative flex-1 overflow-hidden">
          {/* Video grid */}
          <div 
            ref={gridContainerRef}
            className="relative h-full p-2 sm:p-4 overflow-auto"
          >
            {screenLayout === "grid" ? (
              // Grid layout - responsive columns
              <div className={`grid grid-cols-1 ${users.length > 0 ? 'md:grid-cols-2' : ''} ${users.length > 2 ? 'lg:grid-cols-3' : ''} gap-2 sm:gap-4 auto-rows-fr h-full`}>
                {/* My video */}
                {myStream && (
                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    {renderParticipant(myStream, true)}
                  </div>
                )}
    
                {/* Remote videos */}
                {Object.entries(remoteStreams).map(([userId, stream]) => {
                  const user = users.find(u => u.id === userId);
                  return (
                    <div key={userId} className="bg-gray-800 rounded-lg overflow-hidden">
                      {renderParticipant(stream, false, userId, user)}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Spotlight layout
              <div className="flex flex-col h-full">
                <div className="flex-1 mb-2">
                  {/* Main speaker view */}
                  {activeParticipant === "local" && myStream ? (
                    <div className="bg-gray-800 rounded-lg overflow-hidden h-full">
                      {renderParticipant(myStream, true)}
                    </div>
                  ) : (
                    activeParticipant && remoteStreams[activeParticipant] && (
                      <div className="bg-gray-800 rounded-lg overflow-hidden h-full">
                        {renderParticipant(
                          remoteStreams[activeParticipant], 
                          false, 
                          activeParticipant, 
                          users.find(u => u.id === activeParticipant)
                        )}
                      </div>
                    )
                  )}
                </div>
    
                {/* Thumbnails */}
                <div className="flex space-x-2 overflow-x-auto p-2">
                  {/* My video thumbnail */}
                  {myStream && activeParticipant !== "local" && (
                    <div className="flex-shrink-0 w-24 sm:w-32">
                      <div className="bg-gray-800 rounded-lg overflow-hidden">
                        {renderParticipant(myStream, true)}
                      </div>
                    </div>
                  )}
    
                  {/* Remote video thumbnails */}
                  {Object.entries(remoteStreams).map(([userId, stream]) => {
                    if (activeParticipant === userId) return null;
                    const user = users.find(u => u.id === userId);
                    return (
                      <div key={userId} className="flex-shrink-0 w-24 sm:w-32">
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                          {renderParticipant(stream, false, userId, user)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
    
            {/* Layout controls - responsive positioning */}
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-gray-800 bg-opacity-50 rounded-lg p-1 sm:p-2 flex space-x-1 sm:space-x-2 z-10">
              <button 
                onClick={toggleLayout}
                className="p-1 sm:p-2 text-white rounded-full hover:bg-gray-700"
                title={screenLayout === "grid" ? "Switch to spotlight view" : "Switch to grid view"}
              >
                {screenLayout === "grid" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zM8 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zM15 3a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z" />
                  </svg>
                )}
              </button>
              
              <button 
                onClick={toggleFullScreen}
                className="p-1 sm:p-2 text-white rounded-full hover:bg-gray-700"
                title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullScreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v4a1 1 0 01-1 1H1a1 1 0 010-2h1V5a3 3 0 013-3h4a1 1 0 010 2H5zm10 10a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 110 2h-1v3a3 3 0 01-3 3h-4a1 1 0 110-2h4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
    
          {/* Participants panel - responsive width */}
          <div className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-gray-800 shadow-lg transition-transform duration-300 ease-in-out transform ${showParticipants ? 'translate-x-0' : 'translate-x-full'} z-20`}>
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
              <h2 className="text-lg font-medium text-white">People ({users.length + 1})</h2>
              <button 
                onClick={toggleParticipants}
                className="p-2 text-gray-400 rounded-full hover:bg-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
    
            <div className="p-3 overflow-y-auto h-[calc(100%-56px)]">
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-gray-400">In this call ({users.length + 1})</h3>
                <div className="space-y-3">
                  {/* You (host) */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-700">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 mr-2 sm:mr-3 text-white bg-blue-500 rounded-full">
                        {socket.id ? socket.id[0].toUpperCase() : "Y"}
                      </div>
                      <div>
                        <p className="text-sm sm:text-base text-white">You</p>
                        <p className="text-xs text-gray-400">Host</p>
                      </div>
                    </div>
                    <div className="flex space-x-1 sm:space-x-2">
                      {!audioEnabled && (
                        <div className="p-1 bg-red-500 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 9l4.95-4.95a7 7 0 00-9.9 0zM10 11l-4.95 4.95a7 7 0 009.9-9.9L10 11z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {!videoEnabled && (
                        <div className="p-1 bg-red-500 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
    
                  {/* Other participants */}
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700 transition-colors">
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 mr-2 sm:mr-3 text-white bg-purple-500 rounded-full">
                          {user.email[0].toUpperCase()}
                        </div>
                        <p className="text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[180px]">{user.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
    
        {/* Controls - responsive spacing and sizing */}
        <div className="flex items-center justify-center p-2 sm:p-4 bg-gray-800 text-white">
          <div className="flex items-center justify-center space-x-1 sm:space-x-3 flex-wrap">
            <button
              onClick={toggleAudio}
              className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-colors ${
                audioEnabled ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"
              }`}
              title={audioEnabled ? "Mute" : "Unmute"}
            >
              {audioEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-colors ${
                videoEnabled ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"
              }`}
              title={videoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {videoEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <button
              onClick={toggleLayout}
              className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-colors bg-gray-700 hover:bg-gray-600`}
              title={screenLayout === "grid" ? "Switch to spotlight view" : "Switch to grid view"}
            >
              {screenLayout === "grid" ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zM8 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zM15 3a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={toggleParticipants}
              className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-colors ${
                showParticipants ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
              }`}
              title="Participants"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </button>
            
            <button
              onClick={toggleFullScreen}
              className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullScreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v4a1 1 0 01-1 1H1a1 1 0 010-2h1V5a3 3 0 013-3h4a1 1 0 010 2H5zm10 10a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 110 2h-1v3a3 3 0 01-3 3h-4a1 1 0 110-2h4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            <button
              onClick={leaveMeeting}
              className="flex items-center justify-center px-3 py-1 sm:px-4 sm:py-2 ml-1 sm:ml-4 bg-red-500 rounded-full hover:bg-red-600 transition-colors text-sm sm:text-base"
              title="Leave meeting"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              Leave
            </button>
          </div>
        </div>
      </div>
    );

  }

  export default RoomPage;