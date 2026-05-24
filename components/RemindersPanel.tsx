import React, { useState, useEffect } from 'react';
import type { Reminder } from '../types';
import { getAllReminders, saveReminder, deleteReminder } from '../services/storage';
import { formatReminderTime, PRESET_REMINDERS } from '../services/reminders';

interface RemindersPanelProps {
  reminders: Reminder[];
  onAdd: (reminder: Reminder) => Promise<void>;
  onUpdate: (reminder: Reminder) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const RemindersPanel: React.FC<RemindersPanelProps> = ({ reminders, onAdd, onUpdate, onDelete }) => {
  const handleToggle = async (reminder: Reminder) => {
    const updated = { ...reminder, enabled: !reminder.enabled };
    await onUpdate(updated);
  };

  const handleAddPreset = async (preset: typeof PRESET_REMINDERS[0]) => {
    const newReminder: Reminder = {
      ...preset,
      id: `reminder-${Date.now()}`,
      enabled: true,
      createdAt: Date.now(),
    };
    await onAdd(newReminder);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Study Reminders</h1>
        <p className="text-sm text-gray-400 mt-1">Set reminders to keep your study streak going</p>
      </div>

      {/* Existing reminders */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map(reminder => (
            <div
              key={reminder.id}
              className={`bg-gray-800 rounded-xl border p-4 flex items-center gap-4 transition-all ${
                reminder.enabled ? 'border-gray-700' : 'border-gray-700/50 opacity-60'
              }`}
            >
              <button
                onClick={() => handleToggle(reminder)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                  reminder.enabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  reminder.enabled ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{reminder.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatReminderTime(reminder.schedule)}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{reminder.message}</p>
              </div>
              <button
                onClick={() => onDelete(reminder.id)}
                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                title="Delete reminder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add preset reminders */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Add Reminder</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESET_REMINDERS.map((preset, i) => (
            <button
              key={i}
              onClick={() => handleAddPreset(preset)}
              className="text-left bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 hover:border-gray-500 rounded-lg p-3 transition-all"
            >
              <p className="text-sm text-white font-medium">{preset.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatReminderTime(preset.schedule)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
        <p className="text-xs text-gray-500 text-center">
          Reminders are checked while the app is open. Keep the app running to receive notifications.
        </p>
      </div>
    </div>
  );
};

export default RemindersPanel;
