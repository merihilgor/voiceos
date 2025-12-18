import React from 'react';
import { Terminal, FileText, Settings, Globe, Music, Image as ImageIcon, Cpu } from 'lucide-react';

export const WALLPAPER_URL = "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=2070&auto=format&fit=crop";

export const GALLERY_IMAGES = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1563299796-17596ed6bd01?q=80&w=2000&auto=format&fit=crop", // Wheelchair/Paralympic racing representation
    title: "Unstoppable Momentum",
    location: "World Championship Track",
    date: "2024-08-24",
    aiTags: ["Elite Performance", "Aerodynamics", "Pure Speed", "Champion Mindset", "Limitless"],
    description: "A breathtaking capture of elite athletes at peak velocity. The composition highlights the fusion of human strength and precision engineering. The focus is entirely on the relentless drive forward, showcasing that true speed recognizes no physical boundaries."
  }
];

export const MUSIC_TRACKS = [
  {
    id: '1',
    title: "Neural Drift",
    artist: "Synthwave Systems",
    album: "Neon Horizons",
    duration: "3:45",
    cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop"
  },
  {
    id: '2',
    title: "Quantum Focus",
    artist: "Binary Beats",
    album: "Deep Work Vol. 4",
    duration: "4:20",
    cover: "https://images.unsplash.com/photo-1458560871784-56d23406c091?q=80&w=300&auto=format&fit=crop"
  },
  {
    id: '3',
    title: "Atmospheric Layers",
    artist: "VoiceOS Sound Team",
    album: "System Sounds",
    duration: "2:55",
    cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=300&auto=format&fit=crop"
  }
];

export const APP_ICONS = {
  terminal: <Terminal className="w-full h-full text-gray-800 dark:text-gray-200" />,
  notes: <FileText className="w-full h-full text-yellow-500" />,
  settings: <Settings className="w-full h-full text-gray-500" />,
  browser: <Globe className="w-full h-full text-blue-500" />,
  media: <Music className="w-full h-full text-pink-500" />,
  gallery: <ImageIcon className="w-full h-full text-purple-500" />,
  system: <Cpu className="w-full h-full text-green-500" />,
};
