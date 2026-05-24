import React from 'react';
import type { Memory, UserProfile, StudySession } from '../types';
import StreakTracker from './StreakTracker';
import MemoryViewer from './MemoryViewer';

interface StudyDashboardProps {
  memories: Memory[];
  profile: UserProfile | null;
  studySessions: StudySession[];
  onNavigate: (view: string) => void;
  onDeleteMemory?: (id: string) => void;
  onRefreshMemories?: () => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({
  memories, profile, studySessions, onNavigate, onDeleteMemory, onRefreshMemories
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Study Dashboard</h2>

      {/* Streak */}
      <div className="mb-6">
        <StreakTracker
          currentStreak={profile?.streakDays || 0}
          longestStreak={profile?.longestStreak || 0}
          lastStudyDate={profile?.lastStudyDate || null}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{profile?.totalStudySessions || 0}</p>
          <p className="text-xs text-gray-400">Total Sessions</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{memories.length}</p>
          <p className="text-xs text-gray-400">Memories</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{profile?.preferredBooks?.length || 0}</p>
          <p className="text-xs text-gray-400">Books Studied</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{profile?.interests?.length || 0}</p>
          <p className="text-xs text-gray-400">Topics</p>
        </div>
      </div>

      {/* Preferred Books */}
      {profile?.preferredBooks && profile.preferredBooks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">Frequently Studied</h3>
          <div className="flex flex-wrap gap-2">
            {profile.preferredBooks.map(book => (
              <span key={book} className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm">{book}</span>
            ))}
          </div>
        </div>
      )}

      {/* Interests */}
      {profile?.interests && profile.interests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">Topics of Interest</h3>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map(interest => (
              <span key={interest} className="px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full text-sm">{interest}</span>
            ))}
          </div>
        </div>
      )}

      {/* Memories */}
      <div className="mb-6">
        <MemoryViewer
          memories={memories}
          onDelete={onDeleteMemory || (() => {})}
          onRefresh={onRefreshMemories || (() => {})}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onNavigate('chat')} className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors">
            <span className="text-xl">💬</span>
            <p className="text-sm text-white mt-1">Start Study Session</p>
          </button>
          <button onClick={() => onNavigate('scripture-reader')} className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors">
            <span className="text-xl">📖</span>
            <p className="text-sm text-white mt-1">Read Scriptures</p>
          </button>
          <button onClick={() => onNavigate('cross-reference')} className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors">
            <span className="text-xl">🔗</span>
            <p className="text-sm text-white mt-1">Cross-Reference</p>
          </button>
          <button onClick={() => onNavigate('journal')} className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors">
            <span className="text-xl">📓</span>
            <p className="text-sm text-white mt-1">Voice Journal</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyDashboard;
