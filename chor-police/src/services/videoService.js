// src/services/videoService.js
// Real WebRTC mesh service using Google public STUN servers.
// Supports real camera as well as simulated live canvas streams
// (so multi-tab tests on a single computer where the hardware webcam is locked
// by one tab still stream video across all tabs).

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
 * Creates an animated camera stream for testing with multiple tabs on one device
 * when the hardware webcam is occupied by another browser tab.
 */
function createFallbackVideoStream(playerName, avatarEmoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  let angle = 0;

  function draw() {
    angle += 0.04;
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 320, 240);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.5, '#4c1d95');
    grad.addColorStop(1, '#0f051d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 240);

    // Subtle moving grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 320; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 240);
      ctx.stroke();
    }

    // Animated pulsating circle for avatar
    const pulse = Math.sin(angle) * 8;
    const cy = 105;
    ctx.beginPath();
    ctx.arc(160, cy, 46 + pulse * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c4b5fd';
    ctx.stroke();

    // Draw emoji
    ctx.font = '42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(avatarEmoji || '👤', 160, cy);

    // Bottom name bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 190, 320, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(playerName || 'Player', 160, 220);

    // Live indicator dot
    ctx.beginPath();
    ctx.arc(22, 22, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'left';
    ctx.fillText('CAM FEED', 34, 25);

    requestAnimationFrame(draw);
  }
  draw();

  const stream = canvas.captureStream(30);

  // Optional: create a silent audio track so WebRTC audio negotiation succeeds
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const dst = audioCtx.createMediaStreamDestination();
    const gain = audioCtx.createGain();
    gain.gain.value = 0; // silent
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    const silentAudioTrack = dst.stream.getAudioTracks()[0];
    if (silentAudioTrack) {
      stream.addTrack(silentAudioTrack);
    }
  } catch {}

  return stream;
}

function attachLocalTracksToPeers(stream) {
  if (!stream) return;
  for (const [, pc] of peers.entries()) {
    try {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const exists = senders.some((s) => s.track?.kind === track.kind);
        if (!exists) {
          pc.addTrack(track, stream);
        } else {
          // Replace track
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track);
        }
      });
    } catch (e) {
      console.warn('[videoService] Failed attaching track to peer:', e);
    }
  }
}

/**
 * Request local camera + mic.
 * Falls back to simulated stream if hardware camera is already busy/locked
 * (e.g., when testing multiple tabs on the same machine).
 */
export async function getLocalStream({ video = true, audio = true } = {}) {
  const store = useGameStore.getState();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    _localStream = stream;
    store.setLocalStream(stream);
    store.setCameraPermission('granted');
    attachLocalTracksToPeers(stream);
    return stream;
  } catch (err) {
    console.warn(`[videoService] getUserMedia (${err.name}), initializing animated cam feed:`, err.message);
    try {
      const me = store.players.find((p) => p.isLocal);
      const fallbackStream = createFallbackVideoStream(
        store.playerName || me?.name || 'Player',
        me?.avatar || '🦁'
      );
      _localStream = fallbackStream;
      store.setLocalStream(fallbackStream);
      store.setCameraPermission('granted');
      attachLocalTracksToPeers(fallbackStream);
      return fallbackStream;
    } catch (fallbackErr) {
      console.error('[videoService] Fallback stream failed:', fallbackErr);
      store.setCameraPermission('denied');
      store.setLocalStream(null);
      return null;
    }
  }
}

/**
 * Stop all tracks and clear local stream.
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

  if (socket && socket.connected) {
    socket.emit('toggleMedia', { isMuted: newMuted, isCameraOff: store.isCameraOff });
  }

  return newMuted;
}

/**
 * Toggle camera on/off.
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

  if (socket && socket.connected) {
    socket.emit('toggleMedia', { isMuted: store.isMuted, isCameraOff: newOff });
  }

  return newOff;
}

// ── WebRTC Peer Connections ───────────────────────────────────────────────────

export async function createPeerConnection(remotePlayerId, isInitiator = false) {
  if (!remotePlayerId || remotePlayerId === useGameStore.getState().playerId) return null;

  if (peers.has(remotePlayerId)) {
    closePeerConnection(remotePlayerId);
  }

  const pc = new RTCPeerConnection(RTC_CONFIG);
  peers.set(remotePlayerId, pc);

  // Add local tracks if stream is ready
  if (_localStream) {
    _localStream.getTracks().forEach((track) => {
      try { pc.addTrack(track, _localStream); } catch {}
    });
  }

  // Handle incoming remote media tracks
  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      useGameStore.getState().setRemoteStream(remotePlayerId, event.streams[0]);
    }
  };

  // Relay ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && socket && socket.connected) {
      socket.emit('rtc:ice-candidate', {
        targetPlayerId: remotePlayerId,
        candidate: event.candidate,
      });
    }
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'failed' || s === 'closed' || s === 'disconnected') {
      console.info(`[videoService] Connection ${s} for ${remotePlayerId}`);
    }
  };

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
    console.error(`[videoService] handleOffer error from ${remotePlayerId}:`, err);
  }
}

export async function handleAnswer(remotePlayerId, answer) {
  if (!remotePlayerId || !answer) return;
  const pc = peers.get(remotePlayerId);
  if (pc) {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error(`[videoService] handleAnswer error from ${remotePlayerId}:`, err);
    }
  }
}

export async function handleIceCandidate(remotePlayerId, candidate) {
  if (!remotePlayerId || !candidate) return;
  const pc = peers.get(remotePlayerId);
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error(`[videoService] addIceCandidate error from ${remotePlayerId}:`, err);
    }
  }
}

export function closePeerConnection(remotePlayerId) {
  const pc = peers.get(remotePlayerId);
  if (pc) {
    try { pc.close(); } catch {}
    peers.delete(remotePlayerId);
  }
  useGameStore.getState().removeRemoteStream(remotePlayerId);
}

export function closeAllPeerConnections() {
  for (const [, pc] of peers.entries()) {
    try { pc.close(); } catch {}
  }
  peers.clear();
  useGameStore.getState().clearRemoteStreams();
}

// ── Signaling Event Listeners ─────────────────────────────────────────────────

let _initialized = false;

export function initWebRTCSignaling() {
  if (_initialized) return;
  _initialized = true;

  socket.on('rtc:new-peer', ({ peerId }) => {
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

initWebRTCSignaling();
