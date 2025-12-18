import React from 'react';

interface VoiceOrbProps {
  isActive: boolean;
  isThinking: boolean;
  volumeLevel: number;
  onClick: () => void;
}

// Lightweight CSS-only VoiceOrb (no canvas, no requestAnimationFrame)
export const VoiceOrb: React.FC<VoiceOrbProps> = ({ isActive, isThinking }) => {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer Glow Ring */}
      <div
        className={`absolute w-48 h-48 rounded-full transition-all duration-500 ${isActive
            ? 'bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-pink-500/30 animate-pulse'
            : 'bg-white/5'
          }`}
        style={{ filter: 'blur(20px)' }}
      />

      {/* Middle Ring */}
      <div
        className={`absolute w-32 h-32 rounded-full transition-all duration-300 ${isActive
            ? 'bg-gradient-to-r from-purple-400/40 to-blue-400/40'
            : 'bg-white/10'
          }`}
        style={{ filter: 'blur(10px)' }}
      />

      {/* Core Orb */}
      <div
        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${isActive
            ? 'bg-gradient-to-br from-white/80 to-white/60 shadow-lg shadow-purple-500/50'
            : 'bg-white/20'
          }`}
      >
        {/* Status Text */}
        <span className={`text-xs font-medium tracking-widest uppercase ${isActive ? 'text-black/60' : 'text-white/40 animate-pulse'
          }`}>
          {isActive ? (isThinking ? 'Processing' : 'Listening') : 'Starting'}
        </span>
      </div>

      {/* Animated Ring when Active */}
      {isActive && (
        <div className="absolute w-36 h-36 rounded-full border-2 border-white/30 animate-ping" />
      )}
    </div>
  );
};
