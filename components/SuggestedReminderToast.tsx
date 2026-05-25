import React, { useEffect } from 'react';
import type { SuggestedReminder } from '../services/reminders';

interface SuggestedReminderToastProps {
  suggestions: SuggestedReminder[];
  onAccept: (suggestion: SuggestedReminder) => void;
  onDismiss: (suggestion: SuggestedReminder) => void;
}

const SuggestedReminderToast: React.FC<SuggestedReminderToastProps> = ({ suggestions, onAccept, onDismiss }) => {
  const topSuggestion = suggestions[0];

  useEffect(() => {
    if (!topSuggestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss(topSuggestion);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, topSuggestion]);

  if (!topSuggestion) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⏰</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white">Set a reminder?</h4>
            <p className="text-xs text-gray-300 mt-1">{topSuggestion.message}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onAccept(topSuggestion)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
              >
                Yes, remind me
              </button>
              <button
                onClick={() => onDismiss(topSuggestion)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuggestedReminderToast;
