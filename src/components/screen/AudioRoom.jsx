import React, { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import peer from "../../service/peer";
import { useSocket } from "../../context/SoketProvider";

const AudioRoomPage = () => {
  const socket = useSocket();
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [myStream, setMyStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const myStreamRef = useRef(null);
  const audioRefs = useRef({});

  // Handle user joining the room
  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`User ${email} (${id}) joined the room`);
    setUsers((prev) => [...prev, { id, email }]);
  }, []);

  // Handle user leaving the room
  const handleUserLeft = useCallback(({ id }) => {
    console.log(`User ${id} left the room`);
    setUsers((prev) => prev.filter((user) => user.id !== id));
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
        video: false,
      });
      console.log("Local stream initialized:", stream);
      setMyStream(stream);
      myStreamRef.current = stream;

      // Call all existing users in the room
      users.forEach((user) => {
        callUser(user.id);
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  }, [users]);

  // Call a user
  const callUser = useCallback(
    async (userId) => {
      try {
        if (!myStreamRef.current) return;

        const offer = await peer.getOffer(userId);
        socket.emit("user:call", { to: userId, offer });

        // Add tracks to the peer connection
        peer.addTracks(userId, myStreamRef.current);
      } catch (error) {
        console.error("Error calling user:", error);
      }
    },
    [socket]
  );

  // Handle incoming call
  const handleIncomingCall = useCallback(
    async ({ from, offer }) => {
      try {
        // If we don't have our stream yet, get it
        if (!myStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          console.log("Local stream initialized for incoming call:", stream);
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
            console.log(`Received remote stream from ${from}:`, streams[0]);
            setRemoteStreams((prev) => ({
              ...prev,
              [from]: streams[0],
            }));
          }
        };
      } catch (error) {
        console.error("Error handling incoming call:", error);
      }
    },
    [socket]
  );

  // Handle call accepted
  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      try {
        await peer.setRemoteDescription(from, ans);
        console.log("Call accepted by:", from);

        // Set up track event handler if not already done
        const remotePeer = peer.getPeer(from);
        remotePeer.ontrack = ({ streams }) => {
          if (streams[0]) {
            console.log(`Received remote stream from ${from}:`, streams[0]);
            setRemoteStreams((prev) => ({
              ...prev,
              [from]: streams[0],
            }));
          }
        };
      } catch (error) {
        console.error("Error handling call accepted:", error);
      }
    },
    []
  );

  // Handle negotiation needed
  const handleNegotiationNeeded = useCallback(
    async (userId) => {
      try {
        const offer = await peer.getOffer(userId);
        socket.emit("peer:nego:needed", { offer, to: userId });
      } catch (error) {
        console.error("Error during negotiation:", error);
      }
    },
    [socket]
  );

  // Handle incoming negotiation
  const handleNegotiationIncoming = useCallback(
    async ({ from, offer }) => {
      try {
        const ans = await peer.getAnswer(from, offer);
        socket.emit("peer:nego:done", { to: from, ans });
      } catch (error) {
        console.error("Error handling negotiation:", error);
      }
    },
    [socket]
  );

  // Handle final negotiation
  const handleNegotiationFinal = useCallback(
    async ({ from, ans }) => {
      try {
        await peer.setRemoteDescription(from, ans);
      } catch (error) {
        console.error("Error handling final negotiation:", error);
      }
    },
    []
  );

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (myStream) {
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled((prev) => !prev);
    }
  }, [myStream]);

  // Toggle participants panel
  const toggleParticipants = useCallback(() => {
    setShowParticipants((prev) => !prev);
  }, []);

  // Leave meeting
  const leaveMeeting = useCallback(() => {
    // Stop local stream
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
    }

    // Clean up all audio elements
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.srcObject = null;
      }
    });

    // Close all peer connections
    users.forEach((user) => {
      peer.removePeer(user.id);
    });

    // Navigate back to lobby
    navigate("/");
  }, [myStream, users, navigate]);

  // Format meeting time
  const formatMeetingTime = () => {
    const hours = Math.floor(meetingTime / 3600);
    const minutes = Math.floor((meetingTime % 3600) / 60);
    const seconds = meetingTime % 60;

    const formattedHours = hours > 0 ? `${hours}:` : "";
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
    users.forEach((user) => {
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
      setMeetingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Render audio participant card
  const renderAudioParticipant = (stream, isLocal = false, userId = null, user = null) => {
    const participantName = isLocal ? "You" : user ? user.email : "Participant";
    const initial = isLocal
      ? socket.id
        ? socket.id[0].toUpperCase()
        : "Y"
      : user?.email?.[0]?.toUpperCase() || "P";

    return (
      <div className="flex items-center p-3 bg-green-200 rounded-lg shadow-md mb-2">
        <div className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-full mr-3">
          <span className="text-lg font-medium">{initial}</span>
        </div>
        <div className="flex-1">
          <p className="text-green-800 font-medium">{participantName}</p>
          {isLocal && (
            <div className="flex items-center mt-1 space-x-2">
              {!audioEnabled && (
                <div className="p-1 bg-red-500 rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3 h-3 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 9l4.95-4.95a7 7 0 00-9.9 0zM10 11l-4.95 4.95a7 7 0 009.9-9.9L10 11z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Audio visualizer bar (simplified version) */}
        <div className="w-20 h-4 bg-green-100 rounded-full overflow-hidden ml-2">
          <div
            className="h-full bg-green-500"
            style={{
              width: isLocal ? (audioEnabled ? "70%" : "0%") : "60%",
              transition: "width 0.2s ease",
            }}
          ></div>
        </div>
      </div>
    );
  };

  // Render audio elements
  const renderAudioElements = () => {
    return (
      <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        {myStream && (
          <audio
            autoPlay
            muted={true} // Always muted for local stream to prevent echo
            playsInline
            ref={(element) => {
              if (element && myStream) {
                // Only update if srcObject has changed
                if (element.srcObject !== myStream) {
                  element.srcObject = myStream;
                }
              }
            }}
          />
        )}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <audio
            key={userId}
            autoPlay
            playsInline
            ref={(element) => {
              if (element) {
                audioRefs.current[userId] = element;
                // Only update if srcObject has changed
                if (element.srcObject !== stream) {
                  element.srcObject = stream;
                }
              }
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-green-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-green-600 text-white">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
          <h1 className="text-lg font-medium">Audio Room • {roomId}</h1>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm">{formatMeetingTime()}</div>
          <div className="flex items-center px-3 py-1 bg-green-700 rounded-full">
            <span className="w-2 h-2 mr-2 bg-green-300 rounded-full"></span>
            <span className="text-sm">
              {users.length + 1} participant{users.length !== 0 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 p-4 overflow-auto">
        {renderAudioElements()}
        <div className="max-w-3xl mx-auto">
          {/* Room info */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-green-800">Audio Room Session</h2>
            <p className="text-green-600">
              Share this room ID to invite others:{" "}
              <span className="font-mono bg-green-100 px-2 py-1 rounded">{roomId}</span>
            </p>
          </div>

          {/* Participants list */}
          <div className="mb-4">
            <h3 className="text-green-700 font-medium mb-3">Active Participants</h3>

            {/* My audio card */}
            {myStream && renderAudioParticipant(myStream, true)}

            {/* Remote audio cards */}
            {Object.entries(remoteStreams).map(([userId, stream]) => {
              const user = users.find((u) => u.id === userId);
              return (
                <div key={userId}>{renderAudioParticipant(stream, false, userId, user)}</div>
              );
            })}

            {/* Show if no other participants */}
            {users.length === 0 && (
              <div className="p-4 bg-green-100 rounded-lg text-center text-green-700">
                You're the only one here. Invite others to join this audio room.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Participants panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-white shadow-lg transition-transform duration-300 ease-in-out transform ${
          showParticipants ? "translate-x-0" : "translate-x-full"
        } z-20`}
      >
        <div className="flex items-center justify-between p-4 border-b border-green-200">
          <h2 className="text-lg font-medium text-green-800">
            People ({users.length + 1})
          </h2>
          <button
            onClick={toggleParticipants}
            className="p-2 text-green-600 rounded-full hover:bg-green-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-56px)]">
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-green-600">
              In this audio room ({users.length + 1})
            </h3>
            <div className="space-y-3">
              {/* You (host) */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-100">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-10 h-10 mr-3 text-white bg-green-600 rounded-full">
                    {socket.id ? socket.id[0].toUpperCase() : "Y"}
                  </div>
                  <div>
                    <p className="text-green-800 font-medium">You</p>
                    <p className="text-xs text-green-600">Host</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {!audioEnabled && (
                    <div className="p-1 bg-red-500 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 text-white"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 9l4.95-4.95a7 7 0 00-9.9 0zM10 11l-4.95 4.95a7 7 0 009.9-9.9L10 11z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Other participants */}
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 mr-3 text-white bg-green-500 rounded-full">
                      {user.email[0].toUpperCase()}
                    </div>
                    <p className="text-green-800 truncate max-w-[180px]">{user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 bg-white border-t border-green-200">
        <div className="flex items-center justify-center space-x-3">
          <button
            onClick={toggleAudio}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${
              audioEnabled ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
            } text-white`}
            title={audioEnabled ? "Mute" : "Unmute"}
          >
            {audioEnabled ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <button
            onClick={toggleParticipants}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${
              showParticipants
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-green-200 hover:bg-green-300 text-green-800"
            }`}
            title="Participants"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          </button>
          <button
            onClick={leaveMeeting}
            className="flex items-center justify-center px-4 py-2 ml-4 bg-red-500 rounded-full hover:bg-red-600 transition-colors text-white"
            title="Leave meeting"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                clipRule="evenodd"
              />
            </svg>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioRoomPage;