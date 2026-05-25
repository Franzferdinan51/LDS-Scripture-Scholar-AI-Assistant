import React, { useEffect } from 'react';
import type { Reminder } from '../types';

interface ReminderToastProps {
  reminder: Reminder;
  onDismiss: () => void;
  onStartStudy: () => void;
}

const ReminderToast: React.FC<ReminderToastProps> = ({ reminder, onDismiss, onStartStudy }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">{'\u{1F4D6}'}</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white">{reminder.title}</h4>
            <p className="text-xs text-gray-300 mt-1">{reminder.message}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={onStartStudy}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
              >
                Start Study
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderToast;
