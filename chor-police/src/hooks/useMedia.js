// src/hooks/useMedia.js
import { useCallback } from 'react';
import useGameStore from '../store/gameStore';
import { getLocalStream, toggleMic, toggleCamera, stopLocalStream } from '../services/videoService';

export function useMedia() {
  const { localStream, isMuted, isCameraOff, cameraPermission } = useGameStore();

  const requestMedia = useCallback(async () => {
    return getLocalStream({ video: true, audio: true });
  }, []);

  const handleToggleMic    = useCallback(() => toggleMic(),    []);
  const handleToggleCamera = useCallback(() => toggleCamera(), []);
  const handleStop         = useCallback(() => stopLocalStream(), []);

  return {
    localStream,
    isMuted,
    isCameraOff,
    cameraPermission,
    requestMedia,
    toggleMic: handleToggleMic,
    toggleCamera: handleToggleCamera,
    stopStream: handleStop,
  };
}
