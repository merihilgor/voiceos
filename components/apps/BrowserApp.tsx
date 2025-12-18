import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Search, MousePointer2 } from 'lucide-react';

export const BrowserApp: React.FC = () => {
  const [url, setUrl] = useState('https://google.com');
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Automation State
  const [cursor, setCursor] = useState({ x: 50, y: 50, visible: false, clicking: false });
  const [isAutomated, setIsAutomated] = useState(false);

  // Refs for "DOM elements" to target
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handlePlaywrightCmd = async (e: CustomEvent) => {
      const { command, selector, value } = e.detail;
      setIsAutomated(true);

      if (command === 'goto') {
        setIsLoading(true);
        setUrl(value);
        setTimeout(() => setIsLoading(false), 1500);
      }

      if (command === 'fill') {
        // Visualize finding element and typing
        setCursor({ x: 50, y: 50, visible: true, clicking: false });
        // Move cursor to input (simulated)
        setTimeout(() => setCursor({ x: 50, y: 45, visible: true, clicking: false }), 200);
        
        setTimeout(() => {
            setCursor(prev => ({ ...prev, clicking: true }));
            if (selector.includes('input') || selector.includes('q')) {
                let i = 0;
                setSearchValue('');
                const typeInterval = setInterval(() => {
                    setSearchValue(value.substring(0, i + 1));
                    i++;
                    if (i === value.length) {
                        clearInterval(typeInterval);
                        setCursor(prev => ({ ...prev, clicking: false }));
                    }
                }, 100); // Typing speed
            }
        }, 800);
      }

      if (command === 'click') {
        // Move cursor to button area
        setCursor({ x: 50, y: 50, visible: true, clicking: false });
        setTimeout(() => setCursor({ x: 50, y: 55, visible: true, clicking: false }), 400); // Move down towards button
        
        setTimeout(() => {
             setCursor(prev => ({ ...prev, clicking: true })); // Click down
             setTimeout(() => {
                 setCursor(prev => ({ ...prev, clicking: false })); // Click up
                 // Trigger "search"
                 setIsLoading(true);
                 setTimeout(() => {
                     setIsLoading(false);
                     setUrl(`https://google.com/search?q=${encodeURIComponent(searchValue)}`);
                 }, 1000);
             }, 200);
        }, 1000);
      }

      if (command === 'screenshot') {
          // Flash effect
          const flash = document.createElement('div');
          flash.style.position = 'absolute';
          flash.style.inset = '0';
          flash.style.background = 'white';
          flash.style.opacity = '0.8';
          flash.style.zIndex = '100';
          flash.style.transition = 'opacity 0.5s';
          document.querySelector('.browser-content')?.appendChild(flash);
          setTimeout(() => flash.style.opacity = '0', 50);
          setTimeout(() => flash.remove(), 550);
      }
    };

    window.addEventListener('voice-os-playwright-cmd' as any, handlePlaywrightCmd as any);
    return () => window.removeEventListener('voice-os-playwright-cmd' as any, handlePlaywrightCmd as any);
  }, [searchValue]);

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-800 transition-colors relative">
        
        {/* Automation Overlay */}
        {isAutomated && (
            <div className="absolute top-0 right-0 m-2 px-2 py-1 bg-orange-500 text-white text-[10px] font-mono rounded z-50 opacity-80 pointer-events-none">
                PLAYWRIGHT AGENT ACTIVE
            </div>
        )}

        {/* Virtual Cursor */}
        {cursor.visible && (
            <div 
                className="absolute z-50 pointer-events-none transition-all duration-500 ease-in-out"
                style={{ 
                    left: `${cursor.x}%`, 
                    top: `${cursor.y}%`,
                    transform: `translate(-50%, -50%) scale(${cursor.clicking ? 0.9 : 1})`
                }}
            >
                <div className={`w-8 h-8 rounded-full border-2 ${cursor.clicking ? 'bg-red-500/50 border-red-500' : 'bg-transparent border-red-500'} flex items-center justify-center`}>
                    <MousePointer2 className="text-red-600 fill-current" size={24} />
                </div>
            </div>
        )}

        {/* Browser Toolbar */}
        <div className="h-10 flex items-center space-x-2 px-3 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
            <div className="flex space-x-1 text-gray-500">
                <ArrowLeft size={16} />
                <ArrowRight size={16} />
                <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </div>
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-md h-7 flex items-center px-3 text-xs text-gray-700 dark:text-gray-300 shadow-sm overflow-hidden">
                <Search size={12} className="mr-2 opacity-50 flex-shrink-0" />
                <div className="truncate w-full">{url}</div>
            </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-gray-900 flex items-center justify-center flex-col text-gray-400 browser-content relative overflow-hidden">
            {url.includes('google') ? (
                <>
                    <h1 className="text-5xl font-bold mb-8 opacity-80 text-gray-800 dark:text-white tracking-tight">Google</h1>
                    
                    <div className="w-full max-w-md px-4 relative">
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="w-full h-10 px-4 pl-10 rounded-full border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            placeholder="Search..."
                        />
                        <Search className="absolute left-7 top-3 text-gray-400" size={16} />
                    </div>

                    <div className="mt-6 flex space-x-3">
                        <button 
                            ref={buttonRef}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-sm rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Google Search
                        </button>
                        <button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-sm rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            I'm Feeling Lucky
                        </button>
                    </div>
                </>
            ) : (
                <div className="text-center">
                    <div className="text-6xl mb-4">🌐</div>
                    <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400">Navigated to</h2>
                    <p className="text-blue-500 underline mt-2">{url}</p>
                </div>
            )}
        </div>
    </div>
  );
};
