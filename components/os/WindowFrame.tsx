import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';
import { WindowState } from '../../types';

interface WindowFrameProps {
  window: WindowState;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ window: win, onClose, onMinimize, onFocus }) => {
  const [position, setPosition] = useState({ x: 100 + Math.random() * 50, y: 50 + Math.random() * 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Center initially or cascade
    const id = parseInt(win.id.split('-')[1] || '0');
    setPosition({ x: 100 + (id * 30), y: 80 + (id * 30) });
  }, []); // Run once on mount

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (win.isMinimized || !win.isOpen) return null;

  return (
    <div
      style={{
        left: position.x,
        top: position.y,
        zIndex: win.zIndex,
        width: '600px',
        height: '400px',
      }}
      className="absolute flex flex-col rounded-xl overflow-hidden shadow-2xl bg-white dark:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
      onMouseDown={() => onFocus()}
    >
      {/* Title Bar */}
      <div 
        className="h-8 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 cursor-default select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex space-x-2 group">
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-black/50 overflow-hidden">
             <X size={8} className="opacity-0 group-hover:opacity-100" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMinimize(); }} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center text-black/50 overflow-hidden">
             <Minus size={8} className="opacity-0 group-hover:opacity-100" />
          </button>
          <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-black/50 overflow-hidden">
             <Square size={6} className="opacity-0 group-hover:opacity-100" fill="currentColor" />
          </button>
        </div>
        <div className="flex-1 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
          {win.title}
        </div>
        <div className="w-14"></div> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {win.content}
      </div>
    </div>
  );
};
