class PeerService {
  constructor() {
    this.peers = new Map(); 
    this.streamListeners = new Map();
   
    this.config = {
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:global.stun.twilio.com:3478",
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    };
  }

  // Create a new peer connection for a user
  createPeer(userId) {
    if (!this.peers.has(userId)) {
      try {
        console.log(`Creating new peer connection for user: ${userId}`);
        const peer = new RTCPeerConnection(this.config);
        
        // Add ICE candidate handling for better connectivity
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`New ICE candidate for connection with ${userId}`);
          }
        };
        
        peer.onconnectionstatechange = () => {
          console.log(`Connection state changed for ${userId}: ${peer.connectionState}`);
        };
        
        peer.oniceconnectionstatechange = () => {
          console.log(`ICE connection state changed for ${userId}: ${peer.iceConnectionState}`);
        };
        
        // Add track handler to handle incoming streams
        peer.ontrack = (event) => {
          console.log(`Received track from ${userId}`);
          if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            console.log(`Remote stream received for ${userId}: ${remoteStream.id}`);
            
            // Call the stream listener if registered
            const listener = this.streamListeners.get(userId);
            if (listener) {
              listener(remoteStream);
            }
          }
        };
        
        this.peers.set(userId, peer);
        return peer;
      } catch (error) {
        console.error(`Error creating peer for ${userId}:`, error);
        throw error;
      }
    }
    
    return this.peers.get(userId);
  }

  // Get or create a peer connection for a user
  getPeer(userId) {
    const peer = this.peers.get(userId);
    if (!peer) {
      return this.createPeer(userId);
    }
    return peer;
  }

  // Remove a peer connection
  removePeer(userId) {
    console.log(`Removing peer connection for user: ${userId}`);
    const peer = this.peers.get(userId);
    if (peer) {
      peer.close();
      this.peers.delete(userId);
    }
    this.streamListeners.delete(userId);
  }

  // Set a stream listener for a specific user
  setStreamListener(userId, listener) {
    console.log(`Setting stream listener for user: ${userId}`);
    if (typeof listener === 'function') {
      this.streamListeners.set(userId, listener);
      
      // If we already have a peer connection and it already has streams, trigger the listener
      const peer = this.peers.get(userId);
      if (peer && peer.getReceivers) {
        const receivers = peer.getReceivers();
        if (receivers.length > 0) {
          const tracks = receivers.map(receiver => receiver.track).filter(track => track !== null);
          if (tracks.length > 0) {
            const existingStream = new MediaStream(tracks);
            listener(existingStream);
          }
        }
      }
    }
  }

  // Create an offer for a specific user
  async getOffer(userId) {
    try {
      console.log(`Creating offer for user: ${userId}`);
      const peer = this.getPeer(userId);
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peer.setLocalDescription(new RTCSessionDescription(offer));
      return offer;
    } catch (error) {
      console.error(`Error creating offer for ${userId}:`, error);
      throw error;
    }
  }

  // Create an answer for a specific user
  async getAnswer(userId, offer) {
    try {
      console.log(`Creating answer for user: ${userId}`);
      const peer = this.getPeer(userId);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(new RTCSessionDescription(answer));
      return answer;
    } catch (error) {
      console.error(`Error creating answer for ${userId}:`, error);
      throw error;
    }
  }

  // Set remote description for a specific user
  async setRemoteDescription(userId, description) {
    try {
      console.log(`Setting remote description for user: ${userId}`);
      const peer = this.getPeer(userId);
      await peer.setRemoteDescription(new RTCSessionDescription(description));
    } catch (error) {
      console.error(`Error setting remote description for ${userId}:`, error);
      throw error;
    }
  }

  // Add tracks from local stream to a specific peer connection
  addTracks(userId, stream) {
    try {
      console.log(`Adding tracks for user: ${userId}`);
      const peer = this.getPeer(userId);
      
      // First remove any existing senders to avoid duplicates
      const senders = peer.getSenders();
      senders.forEach(sender => {
        peer.removeTrack(sender);
      });
      
      // Then add all tracks from the stream
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });
    } catch (error) {
      console.error(`Error adding tracks for ${userId}:`, error);
      throw error;
    }
  }
}

export default new PeerService();