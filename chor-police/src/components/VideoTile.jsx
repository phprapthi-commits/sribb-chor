// src/components/VideoTile.jsx
// Renders one player's video slot.
// localStream = real MediaStream for the local player;
// others get a placeholder avatar tile in the mock.

import { useRef, useEffect } from 'react';
import Avatar from './Avatar';
import { MicOff, VideoOff, Crown } from 'lucide-react';

export default function VideoTile({
  player,
  stream = null,
  size = 'default',  // 'default' | 'large' | 'small'
  showBorder = false,
  className = '',
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const sizeClasses = {
    small:   'aspect-video rounded-xl',
    default: 'aspect-video rounded-2xl',
    large:   'aspect-video rounded-2xl',
  }[size] || 'aspect-video rounded-2xl';

  return (
    <div
      className={`
        relative overflow-hidden bg-gray-900
        ${sizeClasses}
        ${showBorder ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-transparent' : 'border border-white/10'}
        ${className}
      `}
    >
      {/* Video element (only shows if stream present and camera on) */}
      {stream && !player?.isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          muted={player?.isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        /* Placeholder */
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/60 to-black/60 gap-2">
          <Avatar
            name={player?.name || '?'}
            emoji={player?.avatar}
            size="lg"
          />
          {player?.isCameraOff && (
            <span className="text-xs text-white/50 flex items-center gap-1">
              <VideoOff size={12} /> Camera off
            </span>
          )}
        </div>
      )}

      {/* Overlay: name + badges */}
      <div className="video-overlay absolute inset-x-0 bottom-0 p-2 flex items-end justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {player?.isHost && <Crown size={12} className="text-amber-400 shrink-0" />}
          <span className="text-white text-xs font-medium truncate">
            {player?.name || 'Unknown'}
            {player?.isLocal && <span className="text-violet-300 ml-1">(You)</span>}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {player?.isMuted && (
            <span className="bg-red-500/80 p-0.5 rounded-full" title="Muted">
              <MicOff size={10} />
            </span>
          )}
        </div>
      </div>

      {/* Speaking indicator */}
      {showBorder && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-green-400 pointer-events-none" />
      )}
    </div>
  );
}

