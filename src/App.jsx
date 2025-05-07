import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import './App.css';
import LobbyScreen from './components/screen/Lobby';
import RoomPage from './components/screen/Room';
import AudioRoomPage from './components/screen/AudioRoom';
import AudioLobby from './components/screen/AudioLobby';
import StrangerVideoChat from './components/Stranger/VideoChat';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create-room" element={<LobbyScreen />} />
        {/* <Route path="/video-chat" element={<VideoChat />} /> */}
        <Route path='/room/:room' element={<RoomPage />} /> 
        <Route path='/create-audioroom' element={<AudioLobby />} />
        <Route  path='/audio-room/:room' element={ <AudioRoomPage />} />
        <Route  path='/stranger-videochat' element={<StrangerVideoChat />} />
      </Routes>
    </Router>
  );
}

export default App;