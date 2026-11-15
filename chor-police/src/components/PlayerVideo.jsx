// src/components/PlayerVideo.jsx
// Displays a live video feed for a player if their camera/stream is active,
// with a clean fallback to the player's emoji Avatar when camera is off or unavailable.

import { useRef, useEffect } from 'react';
import Avatar from './Avatar';
import { VideoOff, MicOff } from 'lucide-react';

export default function PlayerVideo({
  player,
  stream = null,
  size = 'md',        // 'sm' | 'md' | 'lg' | 'xl' | 'fill'
  rounded = 'rounded-2xl',
  className = '',
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  const sizeClasses = {
    sm:   'w-12 h-12 text-sm',
    md:   'w-16 h-16 sm:w-20 sm:h-20 text-xl',
    lg:   'w-24 h-24 sm:w-28 sm:h-28 text-3xl',
    xl:   'w-32 h-32 text-4xl',
    fill: 'w-full h-full',
  }[size] || 'w-16 h-16';

  const hasActiveVideo = stream && !player?.isCameraOff;

  return (
    <div
      className={`
        relative overflow-hidden bg-black/50 border border-white/15
        flex items-center justify-center shrink-0 shadow-lg
        ${rounded} ${sizeClasses} ${className}
      `}
    >
      {hasActiveVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={player?.isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <Avatar
          name={player?.name || '?'}
          emoji={player?.avatar}
          size={size === 'fill' ? 'lg' : size}
        />
      )}

      {/* Camera Off indicator badge */}
      {player?.isCameraOff && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
          <Avatar name={player?.name || '?'} emoji={player?.avatar} size={size === 'fill' ? 'lg' : size} />
          <span className="absolute bottom-1 bg-black/70 px-1 py-0.5 rounded text-[10px] text-white/70 flex items-center gap-0.5">
            <VideoOff size={10} /> Off
          </span>
        </div>
      )}

      {/* Muted badge */}
      {player?.isMuted && (
        <span
          className="absolute top-1 right-1 bg-red-600/90 text-white p-0.5 rounded-full shadow"
          title="Microphone muted"
        >
          <MicOff size={10} />
        </span>
      )}
    </div>
  );
}
