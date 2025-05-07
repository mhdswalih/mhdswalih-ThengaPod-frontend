import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from '../../context/SoketProvider';
import Navbar from "../Navbr";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiLock, FiUsers, FiClock, FiPlus, FiEye, FiPlay, FiX, FiInfo } from "react-icons/fi";

const LobbyScreen = () => {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const socket = useSocket();
  const navigate = useNavigate();

  const handleSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      socket.emit("room:join", { email, room });
      
      // Reset submitting state after 2 seconds if navigation doesn't happen
      setTimeout(() => setIsSubmitting(false), 2000);
    },
    [email, room, socket]
  );

  const handleCreateRoom = useCallback(() => {
    setIsCreatingRoom(true);
    // Generate a random room ID
    const randomRoomId = Math.random().toString(36).substring(2, 7);
    setRoom(randomRoomId);
  }, []);

  const handleJoinRoom = useCallback(
    (data) => {
      const { email, room } = data;
      navigate(`/room/${room}`);
    },
    [navigate]
  );

  useEffect(() => {
    socket.on("room:join", handleJoinRoom);
    return () => {
      socket.off("room:join", handleJoinRoom);
    };
  }, [socket, handleJoinRoom]);

  const featureItems = [
    {
      icon: <FiCheck className="text-white" size={20} />,
      title: "HD Quality",
      description: "Crystal clear video and audio",
      color: "text-green-400"
    },
    {
      icon: <FiLock className="text-white" size={20} />,
      title: "Secure",
      description: "End-to-end encrypted chats",
      color: "text-blue-400"
    },
    {
      icon: <FiUsers className="text-white" size={20} />,
      title: "Group Chats",
      description: "Connect with multiple people",
      color: "text-purple-400"
    },
    {
      icon: <FiClock className="text-white" size={20} />,
      title: "No Time Limits",
      description: "Chat as long as you want",
      color: "text-yellow-400"
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-green-50 to-green-100 text-gray-800'}`}>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-12">
          {/* Left side - Info content */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:w-1/2"
          >
            <motion.h2 
              className={`text-4xl md:text-5xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Start or Join a <span className="text-green-600">Video Chat</span>
            </motion.h2>
            
            <motion.p 
              className={`text-lg mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Connect with friends, family, or colleagues in real-time with crystal clear video and audio.
              Create your own room or join an existing one.
            </motion.p>
            
            {/* Features */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {featureItems.map((item, index) => (
                <motion.div 
                  key={index}
                  className={`flex items-start space-x-4 p-4 rounded-xl transition-all duration-300 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-green-50'} shadow-sm hover:shadow-md`}
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className={`p-3 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-green-100'} flex-shrink-0`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${item.color}`}>{item.title}</h3>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right side - Join/Create form */}
          <motion.div 
            className="w-full lg:w-2/5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isCreatingRoom ? "create" : "join"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={`p-8 rounded-2xl shadow-xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
              >
                <h3 className={`text-2xl font-bold mb-6 text-center ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {isCreatingRoom ? "Create Your Room" : "Join a Video Chat"}
                </h3>
                 
                <form onSubmit={handleSubmitForm} className="space-y-5">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label htmlFor="email" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="email"
                      className={`w-full px-4 py-3 rounded-lg border transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-green-500'} focus:outline-none focus:ring-2 focus:ring-green-500/30`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your name"
                      required
                    />
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label htmlFor="room" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {isCreatingRoom ? "Room Code (Share this with others)" : "Room Code"}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="room"
                        className={`w-full px-4 py-3 rounded-lg border transition-all ${darkMode ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-green-500'} ${isCreatingRoom ? 'bg-opacity-80' : ''} focus:outline-none focus:ring-2 focus:ring-green-500/30`}
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder={isCreatingRoom ? "" : "Enter room code to join"}
                        readOnly={isCreatingRoom}
                        required
                      />
                      {isCreatingRoom && (
                        <motion.div 
                          className="absolute right-3 top-3"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          <span className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
                            New Room
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>

                  {!isCreatingRoom ? (
                    <motion.div 
                      className="flex flex-col sm:flex-row gap-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <motion.button
                        type="button"
                        onClick={handleCreateRoom}
                        className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors duration-300"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <FiPlus size={18} />
                        <span>Create Room</span>
                      </motion.button>
                      <motion.button
                        type="submit"
                        className={`flex-1 flex items-center justify-center space-x-2 ${
                          !email || !room 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        } text-white px-4 py-3 rounded-lg font-medium transition-colors duration-300`}
                        disabled={!email || !room || isSubmitting}
                        whileHover={(!email || !room) ? {} : { scale: 1.02 }}
                        whileTap={(!email || !room) ? {} : { scale: 0.98 }}
                      >
                        {isSubmitting ? (
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : (
                          <>
                            <FiEye size={18} />
                            <span>Join Room</span>
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <motion.button
                        type="submit"
                        className={`w-full flex items-center justify-center space-x-2 ${
                          !email ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                        } text-white px-4 py-3 rounded-lg font-medium transition-colors duration-300`}
                        disabled={!email || isSubmitting}
                        whileHover={!email ? {} : { scale: 1.02 }}
                        whileTap={!email ? {} : { scale: 0.98 }}
                      >
                        {isSubmitting ? (
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : (
                          <>
                            <FiPlay size={18} />
                            <span>Start Meeting</span>
                          </>
                        )}
                      </motion.button>
                      
                      <motion.button
                        type="button"
                        onClick={() => setIsCreatingRoom(false)}
                        className={`w-full flex items-center justify-center space-x-2 ${
                          darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                        } ${darkMode ? 'text-white' : 'text-gray-800'} px-4 py-3 rounded-lg font-medium transition-colors duration-300 mt-3`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <FiX size={18} />
                        <span>Back to Options</span>
                      </motion.button>
                    </motion.div>
                  )}
                </form>
              </motion.div>
            </AnimatePresence>
            
            {/* Quick help text */}
            <motion.div 
              className={`mt-4 text-sm rounded-lg p-4 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600'} shadow-md`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="flex items-start">
                <FiInfo className="mt-1 mr-2 text-green-500 flex-shrink-0" size={18} />
                <span>To join an existing room, enter the room code provided by the creator and click "Join Room".</span>
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div 
          className={`mt-16 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p>Join thousands of users chatting in real-time every day</p>
          <motion.div 
            className="flex justify-center mt-4 space-x-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-inner flex items-center justify-center`}
                animate={{ 
                  y: [0, -5, 0],
                  transition: { 
                    duration: 2, 
                    repeat: Infinity,
                    delay: i * 0.2
                  }
                }}
              >
                <span className="text-xs">👤</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default LobbyScreen;