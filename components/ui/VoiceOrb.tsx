import React from 'react';

interface VoiceOrbProps {
  isActive: boolean;
  isThinking: boolean;
  isListening?: boolean; // Wake word activated - actively listening for commands
  wakeWord?: string; // Current wake word to display
  volumeLevel: number;
  onClick: () => void;
  context?: string;
}

/**
 * Siri-inspired Voice Orb - Elegant flowing gradient with glow effects
 */
export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isActive,
  isThinking,
  isListening = false,
  wakeWord = 'ayo',
  volumeLevel,
  context
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center">

      {/* Outer glow layer */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          width: '280px',
          height: '280px',
          background: isActive
            ? 'radial-gradient(circle, rgba(255,107,157,0.2), rgba(192,132,252,0.15), transparent 70%)'
            : 'radial-gradient(circle, rgba(100,100,120,0.1), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Pulsing rings when active */}
      {isActive && (
        <>
          <div
            className="absolute w-64 h-64 rounded-full"
            style={{
              border: '1px solid rgba(255, 107, 157, 0.3)',
              animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite'
            }}
          />
          <div
            className="absolute w-72 rounded-full"
            style={{
              width: '320px',
              height: '320px',
              border: '1px solid rgba(192, 132, 252, 0.2)',
              animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
              animationDelay: '1s'
            }}
          />
        </>
      )}

      {/* Main Siri-style gradient orb */}
      <div
        className="relative rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          width: '200px',
          height: '200px',
          background: isActive
            ? 'linear-gradient(135deg, #ff6b9d 0%, #c084fc 25%, #60a5fa 50%, #22d3ee 75%, #a855f7 100%)'
            : 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #4b5563 100%)',
          backgroundSize: isActive ? '400% 400%' : '100% 100%',
          animation: isActive
            ? 'siri-gradient 4s ease infinite'
            : 'none',
          boxShadow: isActive
            ? `0 0 60px rgba(255, 107, 157, 0.4),
               0 0 120px rgba(192, 132, 252, 0.3),
               0 0 180px rgba(96, 165, 250, 0.2)`
            : '0 0 40px rgba(100, 100, 120, 0.2)',
          transform: isActive ? `scale(${1 + volumeLevel * 0.1})` : 'scale(1)',
        }}
      >
        {/* Inner dark circle with glass effect */}
        <div
          className="absolute rounded-full"
          style={{
            width: '180px',
            height: '180px',
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.08), transparent 50%), linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
            boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5)',
          }}
        />

        {/* Content container */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          {/* Status icon */}
          <div
            className="mb-2 transition-all duration-300"
            style={{
              color: isActive ? '#ff6b9d' : '#6b7280',
              filter: isActive ? 'drop-shadow(0 0 8px rgba(255,107,157,0.5))' : 'none'
            }}
          >
            {isThinking ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" style={{ animation: 'pulse 1s ease infinite' }}>
                <circle cx="6" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" style={{ animationDelay: '0.2s' }} />
                <circle cx="18" cy="12" r="2" style={{ animationDelay: '0.4s' }} />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </div>

          {/* Status text */}
          <span
            className="text-xs font-semibold uppercase"
            style={{
              letterSpacing: '0.2em',
              color: isListening
                ? '#22d3ee' // Cyan when actively listening
                : isActive
                  ? isThinking ? '#c084fc' : '#ff6b9d'
                  : '#6b7280',
              textShadow: isListening
                ? '0 0 10px rgba(34,211,238,0.5)'
                : isActive ? '0 0 10px rgba(255,107,157,0.5)' : 'none'
            }}
          >
            {isThinking ? 'PROCESSING' : isListening ? 'LISTENING...' : isActive ? `SAY "${(wakeWord || 'AYO').toUpperCase()}"` : 'STANDBY'}
          </span>

          {/* Context indicator */}
          {context && isActive && (
            <span
              className="mt-2 font-medium"
              style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.1em'
              }}
            >
              {context}
            </span>
          )}
        </div>
      </div>

      {/* Floating animation for entire orb when active */}
      <style>{`
        @keyframes siri-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};
