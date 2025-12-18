import React, { useState } from 'react';
import { Shield, Building, Heart, Cpu, Activity, Globe, CheckCircle } from 'lucide-react';

export const SystemApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('mission');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Cpu className="text-white" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">VoiceOS <span className="text-xs align-top bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">BETA</span></h2>
                <p className="text-gray-500">Version 1.0.4 (Semantic Core)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Processor</div>
                  <div className="font-mono text-sm">Gemini 2.5 Flash Neural Engine</div>
               </div>
               <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Memory</div>
                  <div className="font-mono text-sm">Unified Context Window</div>
               </div>
            </div>
          </div>
        );
      case 'mission':
        return (
          <div className="space-y-6 animate-fadeIn">
             <div>
                <h3 className="text-xl font-bold mb-2">Sustainable Access Model</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                   VoiceOS is built on a philosophy of equity. We believe advanced technology should eliminate barriers, not create financial ones.
                </p>
             </div>

             <div className="grid gap-4">
                {/* Individual Tier */}
                <div className="relative overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 p-5 rounded-xl">
                   <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                         <div className="p-2 bg-green-100 dark:bg-green-800 rounded-lg text-green-600 dark:text-green-300">
                            <Heart size={20} />
                         </div>
                         <div>
                            <h4 className="font-bold text-green-900 dark:text-green-100">Community Access</h4>
                            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Free Forever</p>
                         </div>
                      </div>
                      <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                   </div>
                   <p className="mt-3 text-sm text-green-800 dark:text-gray-300">
                      For individuals overcoming physical barriers. We reject the label "disabled"—this is a tool for elite performance. No costs, no limits.
                   </p>
                </div>

                {/* Enterprise Tier */}
                <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-xl hover:border-purple-400 transition-colors">
                   <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                         <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                            <Building size={20} />
                         </div>
                         <div>
                            <h4 className="font-bold">Enterprise Partnership</h4>
                            <p className="text-xs text-purple-500 font-medium">Corporate Licensing</p>
                         </div>
                      </div>
                   </div>
                   <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      For organizations large enough to lead. Your licensing fees subsidize the development of this platform and support the employment of neurodivergent and physically diverse talent.
                   </p>
                   <button className="mt-4 w-full py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                      Purchase Enterprise License
                   </button>
                </div>
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <div className="w-48 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col space-y-1 bg-gray-100/50 dark:bg-black/20">
        <button
          onClick={() => setActiveTab('overview')}
          className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
        >
          <div className="flex items-center space-x-2">
            <Activity size={16} />
            <span>Overview</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('mission')}
          className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'mission' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
        >
          <div className="flex items-center space-x-2">
            <Globe size={16} />
            <span>Mission & License</span>
          </div>
        </button>
        <div className="pt-4 mt-auto">
             <div className="px-3 text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">System</div>
             <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-500">
                <Shield size={14} />
                <span>Secure Boot</span>
             </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};
