import React from 'react';
import { AppDefinition } from '../../types';

interface DockProps {
  apps: AppDefinition[];
  openApps: string[];
  onAppClick: (id: string) => void;
}

export const Dock: React.FC<DockProps> = ({ apps, openApps, onAppClick }) => {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-end space-x-2 px-4 py-3 bg-white/20 dark:bg-black/30 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl">
        {apps.map((app) => (
          <div key={app.id} className="group relative flex flex-col items-center">
            <button
              onClick={() => onAppClick(app.id)}
              className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl p-2 shadow-lg hover:scale-110 transition-transform duration-200 ease-out active:scale-95"
            >
              {app.icon}
            </button>
            {/* Status Indicator Dot */}
            <div className={`mt-1 w-1 h-1 rounded-full bg-white transition-opacity duration-300 ${openApps.includes(app.id) ? 'opacity-100' : 'opacity-0'}`} />
            
            {/* Tooltip */}
            <div className="absolute -top-10 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {app.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
