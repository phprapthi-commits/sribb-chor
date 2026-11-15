// src/components/Timer.jsx
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Timer({ seconds, totalSeconds = 60, size = 'md' }) {
  const progress = Math.max(0, seconds / totalSeconds);
  const offset = CIRCUMFERENCE * (1 - progress);
  const urgent = seconds <= 10;

  const sizePx = { sm: 80, md: 110, lg: 140 }[size] || 110;
  const fontSize = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }[size] || 'text-2xl';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 100 100"
        className="-rotate-90"
      >
        {/* Background ring */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        {/* Progress ring */}
        <motion.circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={urgent ? '#ef4444' : '#8b5cf6'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </svg>
      {/* Number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={seconds}
          initial={{ scale: urgent ? 1.3 : 1 }}
          animate={{ scale: 1 }}
          className={`${fontSize} font-bold tabular-nums ${urgent ? 'text-red-400' : 'text-white'}`}
        >
          {Math.max(0, seconds)}
        </motion.span>
      </div>
    </div>
  );
}

