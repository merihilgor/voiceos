import React, { useState } from 'react';

export const NoteApp: React.FC = () => {
  const [notes, setNotes] = useState<string>(
    "System Log: VoiceOS Interface Initialized.\n\n" +
    "Daily Insight:\n" +
    "\"The only limits that truly exist are the ones we place on our own potential. Success is a mindset, not a physical state.\"\n\n" +
    "Commands to try:\n" +
    "- 'Open Gallery' (See the new analysis)\n" +
    "- 'Switch to Dark Mode'\n" +
    "- 'Close this window'"
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center text-xs">
        <span className="font-semibold text-gray-500">All Notes</span>
        <button className="text-blue-500 hover:text-blue-600">New Note</button>
      </div>
      <textarea
        className="flex-1 p-4 resize-none bg-transparent outline-none font-mono text-sm leading-relaxed"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};
