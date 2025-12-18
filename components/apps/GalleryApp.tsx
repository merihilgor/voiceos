import React, { useState } from 'react';
import { GALLERY_IMAGES } from '../../constants';
import { Info, Share2, Heart, Sparkles, MapPin, Calendar } from 'lucide-react';

export const GalleryApp: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState(GALLERY_IMAGES[0]);
  const [showAiLens, setShowAiLens] = useState(true);

  return (
    <div className="h-full flex bg-black text-white overflow-hidden">
      {/* Main Image Area */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-900">
        <img 
          src={selectedImage.url} 
          alt={selectedImage.title} 
          className="max-w-full max-h-full object-contain"
        />
        
        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 flex space-x-2">
            <button 
                onClick={() => setShowAiLens(!showAiLens)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all ${showAiLens ? 'bg-purple-500/20 border-purple-500/50 text-purple-200' : 'bg-black/30 border-white/10 text-white'}`}
            >
                <Sparkles size={14} />
                <span className="text-xs font-medium">AI Lens</span>
            </button>
        </div>
      </div>

      {/* Intelligent Sidebar */}
      {showAiLens && (
        <div className="w-72 bg-gray-900/95 border-l border-white/10 flex flex-col backdrop-blur-xl transition-all duration-300">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">{selectedImage.title}</h2>
            <div className="flex items-center space-x-4 mt-2 text-gray-400 text-xs">
                <div className="flex items-center space-x-1">
                    <MapPin size={10} />
                    <span>{selectedImage.location}</span>
                </div>
                <div className="flex items-center space-x-1">
                    <Calendar size={10} />
                    <span>{selectedImage.date}</span>
                </div>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            {/* AI Analysis Section */}
            <div className="mb-6">
                <div className="flex items-center space-x-2 mb-3 text-purple-400">
                    <Sparkles size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">VoiceOS Intelligence</span>
                </div>
                
                <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20 mb-4">
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {selectedImage.description}
                    </p>
                </div>

                <div className="space-y-3">
                    <div>
                        <span className="text-xs text-gray-500 uppercase font-semibold">Detected Objects</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedImage.aiTags.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-white/10 rounded-md text-xs text-gray-200 hover:bg-white/20 cursor-default">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                         <span className="text-xs text-gray-500 uppercase font-semibold">Color Palette</span>
                         <div className="flex space-x-2 mt-2">
                             <div className="w-6 h-6 rounded-full bg-blue-600 ring-2 ring-white/10"></div>
                             <div className="w-6 h-6 rounded-full bg-orange-500 ring-2 ring-white/10"></div>
                             <div className="w-6 h-6 rounded-full bg-gray-800 ring-2 ring-white/10"></div>
                             <div className="w-6 h-6 rounded-full bg-red-600 ring-2 ring-white/10"></div>
                         </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-white/10 flex justify-between">
              <button className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"><Share2 size={18} /></button>
              <button className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-red-500"><Heart size={18} /></button>
              <button className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-blue-400"><Info size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
};
