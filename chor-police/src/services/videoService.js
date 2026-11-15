// src/services/videoService.js
// Real WebRTC mesh service using Google public STUN servers.
// Automatically manages peer connections between up to 6 players,
// attaches local media tracks, relays signaling over Socket.IO,
// and publishes remote MediaStreams to Zustand store.

import useGameStore from '../store/gameStore';
import { socket } from './gameService';

let _localStream = null;
const peers = new Map(); // remotePlayerId -> RTCPeerConnection

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * Request local camera + mic.
 * Returns the MediaStream on success.
 * Also attaches newly acquired tracks to any active peer connections.
 */
export async function getLocalStream({ video = true, audio = true } = {}) {
  const store = useGameStore.getState();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    _localStream = stream;
    store.setLocalStream(stream);
    store.setCameraPermission('granted');

    // Attach local tracks to any existing peer connections
    for (const [peerId, pc] of peers.entries()) {
      stream.getTracks().forEach((track) => {
        const senders = pc.getSenders();
        const exists = senders.some((s) => s.track?.kind === track.kind);
        if (!exists) {
          pc.addTrack(track, stream);
        }
      });
    }

    return stream;
  } catch (err) {
    console.warn('[videoService] getUserMedia failed or denied:', err.name);
    store.setCameraPermission('denied');
    store.setLocalStream(null);
    return null;
  }
}

/**
 * Stop all local tracks, close all peer connections, and clean up.
 */
export function stopLocalStream() {
  if (_localStream) {
    _localStream.getTracks().forEach((t) => t.stop());
    _localStream = null;
  }
  useGameStore.getState().setLocalStream(null);
  closeAllPeerConnections();
}

/**
 * Toggle mute state on the local audio track.
 */
export function toggleMic() {
  const store = useGameStore.getState();
  const newMuted = !store.isMuted;
  if (_localStream) {
    _localStream.getAudioTracks().forEach((t) => {
      t.enabled = !newMuted;
    });
  }
  store.setIsMuted(newMuted);

  // Notify peers via server
  if (socket && socket.connected) {
    socket.emit('toggleMedia', { isMuted: newMuted, isCameraOff: store.isCameraOff });
  }

  return newMuted;
}

/**
 * Toggle camera on/off on the local video track.
 */
export function toggleCamera() {
  const store = useGameStore.getState();
  const newOff = !store.isCameraOff;
  if (_localStream) {
    _localStream.getVideoTracks().forEach((t) => {
      t.enabled = !newOff;
    });
  }
  store.setIsCameraOff(newOff);

  // Notify peers via server
  if (socket && socket.connected) {
    socket.emit('toggleMedia', { isMuted: store.isMuted, isCameraOff: newOff });
  }

  return newOff;
}

// ── WebRTC Peer Connection Mesh ───────────────────────────────────────────────

/**
 * Create a new RTCPeerConnection for a remote player.
 * @param {string} remotePlayerId - Target player ID
 * @param {boolean} isInitiator - Whether this peer creates and sends the SDP offer
 */
export async function createPeerConnection(remotePlayerId, isInitiator = false) {
  if (!remotePlayerId || remotePlayerId === useGameStore.getState().playerId) return null;

  if (peers.has(remotePlayerId)) {
    closePeerConnection(remotePlayerId);
  }

  const pc = new RTCPeerConnection(RTC_CONFIG);
  peers.set(remotePlayerId, pc);

  // Add local tracks if available
  if (_localStream) {
    _localStream.getTracks().forEach((track) => {
      pc.addTrack(track, _localStream);
    });
  }

  // Handle incoming remote media tracks
  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      useGameStore.getState().setRemoteStream(remotePlayerId, event.streams[0]);
    }
  };

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && socket && socket.connected) {
      socket.emit('rtc:ice-candidate', {
        targetPlayerId: remotePlayerId,
        candidate: event.candidate,
      });
    }
  };

  // Connection state changes
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === 'failed' || state === 'closed' || state === 'disconnected') {
      console.info(`[videoService] PC state ${state} for ${remotePlayerId}`);
    }
  };

  // If initiator, generate offer
  if (isInitiator) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socket && socket.connected) {
        socket.emit('rtc:offer', {
          targetPlayerId: remotePlayerId,
          offer,
        });
      }
    } catch (err) {
      console.error(`[videoService] createOffer failed for ${remotePlayerId}:`, err);
    }
  }

  return pc;
}

/**
 * Handle incoming SDP offer from a remote peer.
 */
export async function handleOffer(remotePlayerId, offer) {
  if (!remotePlayerId || !offer) return;
  try {
    let pc = peers.get(remotePlayerId);
    if (!pc) {
      pc = await createPeerConnection(remotePlayerId, false);
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (socket && socket.connected) {
      socket.emit('rtc:answer', {
        targetPlayerId: remotePlayerId,
        answer,
      });
    }
  } catch (err) {
    console.error(`[videoService] handleOffer failed from ${remotePlayerId}:`, err);
  }
}

/**
 * Handle incoming SDP answer from a remote peer.
 */
export async function handleAnswer(remotePlayerId, answer) {
  if (!remotePlayerId || !answer) return;
  const pc = peers.get(remotePlayerId);
  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error(`[videoService] handleAnswer failed from ${remotePlayerId}:`, err);
    }
  }
}

/**
 * Handle incoming ICE candidate from a remote peer.
 */
export async function handleIceCandidate(remotePlayerId, candidate) {
  if (!remotePlayerId || !candidate) return;
  const pc = peers.get(remotePlayerId);
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error(`[videoService] addIceCandidate failed from ${remotePlayerId}:`, err);
    }
  }
}

/**
 * Close and clean up a single peer connection.
 */
export function closePeerConnection(remotePlayerId) {
  const pc = peers.get(remotePlayerId);
  if (pc) {
    pc.close();
    peers.delete(remotePlayerId);
  }
  useGameStore.getState().removeRemoteStream(remotePlayerId);
}

/**
 * Close all active peer connections.
 */
export function closeAllPeerConnections() {
  for (const [peerId, pc] of peers.entries()) {
    try { pc.close(); } catch {}
  }
  peers.clear();
  useGameStore.getState().clearRemoteStreams();
}

// ── Auto-wire socket WebRTC signaling events ──────────────────────────────────

let _initialized = false;

export function initWebRTCSignaling() {
  if (_initialized) return;
  _initialized = true;

  socket.on('rtc:new-peer', ({ peerId }) => {
    // Existing players initiate an offer to newcomer
    createPeerConnection(peerId, true);
  });

  socket.on('rtc:offer', ({ fromPlayerId, offer }) => {
    handleOffer(fromPlayerId, offer);
  });

  socket.on('rtc:answer', ({ fromPlayerId, answer }) => {
    handleAnswer(fromPlayerId, answer);
  });

  socket.on('rtc:ice-candidate', ({ fromPlayerId, candidate }) => {
    handleIceCandidate(fromPlayerId, candidate);
  });

  socket.on('onPlayerLeft', ({ playerId }) => {
    closePeerConnection(playerId);
  });

  socket.on('onPlayerMediaChanged', ({ playerId, isMuted, isCameraOff }) => {
    useGameStore.getState().updatePlayerMedia(playerId, { isMuted, isCameraOff });
  });
}

// Initialize listeners on module load
initWebRTCSignaling();
