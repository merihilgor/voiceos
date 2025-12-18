import React from 'react';

export const TerminalApp: React.FC = () => {
  return (
    <div className="h-full bg-black text-green-400 p-4 font-mono text-xs overflow-y-auto">
      <div className="mb-2">Last login: {new Date().toDateString()} on ttys000</div>
      <div className="mb-2">VoiceOS Kernel v1.0.0 init...</div>
      <div className="mb-4">
        <p className="text-white">user@voice-os ~ %</p>
        <p>Listening for audio input stream...</p>
        <p>Gemini Live API: Connected</p>
        <p>System Status: Normal</p>
      </div>
      <div className="animate-pulse">_</div>
    </div>
  );
};
