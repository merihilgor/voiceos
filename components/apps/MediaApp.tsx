import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, Mic, Disc } from 'lucide-react';
import { MUSIC_TRACKS } from '../../constants';

export const MediaApp: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const currentTrack = MUSIC_TRACKS[currentTrackIndex];

  // Simulated progress bar
  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 0.5));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Listen for Voice Commands via Custom Event
  useEffect(() => {
    const handleVoiceControl = (e: CustomEvent) => {
      const action = e.detail.action;
      if (action === 'play') setIsPlaying(true);
      if (action === 'pause') setIsPlaying(false);
      if (action === 'next') handleNext();
      if (action === 'prev') handlePrev();
    };

    window.addEventListener('voice-os-media-control' as any, handleVoiceControl as any);
    return () => window.removeEventListener('voice-os-media-control' as any, handleVoiceControl as any);
  }, [currentTrackIndex]);

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % MUSIC_TRACKS.length);
    setProgress(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length);
    setProgress(0);
    setIsPlaying(true);
  };

  return (
    <div className="h-full flex bg-gray-900 text-white overflow-hidden">
      {/* Sidebar / Playlist */}
      <div className="w-1/3 bg-gray-900 border-r border-white/10 p-4 flex flex-col hidden sm:flex">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Your Library</h2>
        <div className="space-y-1">
          {MUSIC_TRACKS.map((track, idx) => (
            <button
              key={track.id}
              onClick={() => { setCurrentTrackIndex(idx); setIsPlaying(true); setProgress(0); }}
              className={`w-full text-left p-2 rounded-md text-sm flex items-center space-x-3 transition-colors ${idx === currentTrackIndex ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="w-8 h-8 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                <img src={track.cover} alt="Cover" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{track.title}</div>
                <div className="text-xs text-gray-500 truncate">{track.artist}</div>
              </div>
              {idx === currentTrackIndex && isPlaying && (
                 <div className="ml-auto flex space-x-0.5 items-end h-3">
                     <div className="w-0.5 bg-green-500 animate-pulse h-full"></div>
                     <div className="w-0.5 bg-green-500 animate-pulse h-2"></div>
                     <div className="w-0.5 bg-green-500 animate-pulse h-3"></div>
                 </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Player View */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-800 to-gray-900">
        {/* Album Art Area */}
        <div className="flex-1 flex items-center justify-center p-8 flex-col">
            <div className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-xl shadow-2xl overflow-hidden mb-8 transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
                {/* Vinyl Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
            </div>

            <div className="text-center">
                <h1 className="text-2xl font-bold mb-1">{currentTrack.title}</h1>
                <p className="text-gray-400">{currentTrack.artist} — {currentTrack.album}</p>
            </div>
        </div>

        {/* Controls */}
        <div className="h-32 bg-gray-900/50 backdrop-blur-md border-t border-white/10 p-4 sm:p-6 flex flex-col justify-center">
            {/* Progress */}
            <div className="w-full bg-gray-700 h-1 rounded-full mb-6 overflow-hidden group cursor-pointer">
                <div 
                    className="bg-pink-500 h-full rounded-full transition-all duration-1000 ease-linear relative" 
                    style={{ width: `${progress}%` }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow"></div>
                </div>
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto w-full">
                <button className="text-gray-400 hover:text-white transition-colors"><Heart size={20} /></button>
                
                <div className="flex items-center space-x-6">
                    <button onClick={handlePrev} className="text-gray-300 hover:text-white transition-transform active:scale-90"><SkipBack size={24} /></button>
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)} 
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-white/10"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button onClick={handleNext} className="text-gray-300 hover:text-white transition-transform active:scale-90"><SkipForward size={24} /></button>
                </div>

                <button className={`transition-colors ${isPlaying ? 'text-green-400' : 'text-gray-500'}`} title="AI DJ Active">
                    <Mic size={20} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
