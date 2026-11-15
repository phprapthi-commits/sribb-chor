// src/components/PlayerVideo.jsx
// Displays a player's live video stream (local or remote),
// falling back to their Avatar if camera is off or stream is not available.

import { useRef, useEffect } from 'react';
import Avatar from './Avatar';
import { VideoOff } from 'lucide-react';

export default function PlayerVideo({
  player,
  stream,
  className = '',
  avatarSize = 'md',
  showName = false,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const isVideoActive = stream && !player?.isCameraOff;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-950/80 to-black/80 border border-white/20 flex items-center justify-center ${className}`}
    >
      {isVideoActive ? (
        <video
          ref={videoRef}
          autoPlay
          muted={player?.isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-2 gap-1 text-center">
          <Avatar
            name={player?.name || '?'}
            emoji={player?.avatar}
            size={avatarSize}
          />
          {player?.isCameraOff && (
            <span className="text-[10px] text-white/50 flex items-center gap-0.5">
              <VideoOff size={10} /> Camera off
            </span>
          )}
        </div>
      )}

      {showName && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 flex items-center justify-between">
          <span className="text-xs text-white font-medium truncate">
            {player?.name} {player?.isLocal && <span className="text-violet-300">(You)</span>}
          </span>
        </div>
      )}
    </div>
  );
}

