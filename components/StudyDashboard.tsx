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

      {/* Achievements */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Achievements</h3>
        {(() => {
          const achievements = [
            { id: 'first_steps', name: 'First Steps', icon: '👣', desc: 'Complete your first study session', earned: (profile?.totalStudySessions || 0) >= 1 },
            { id: 'week_warrior', name: 'Week Warrior', icon: '⚔️', desc: '7-day study streak', earned: (profile?.streakDays || 0) >= 7 },
            { id: 'month_master', name: 'Month Master', icon: '👑', desc: '30-day study streak', earned: (profile?.longestStreak || 0) >= 30 },
            { id: 'scripture_scholar', name: 'Scripture Scholar', icon: '📚', desc: 'Study 5 different books', earned: (profile?.preferredBooks?.length || 0) >= 5 },
            { id: 'deep_diver', name: 'Deep Diver', icon: '🤿', desc: 'Store 10+ memories', earned: memories.length >= 10 },
            { id: 'topic_explorer', name: 'Topic Explorer', icon: '🧭', desc: 'Explore 5+ topics', earned: (profile?.interests?.length || 0) >= 5 },
            { id: 'marathon', name: 'Marathon', icon: '🏃', desc: '50+ study sessions', earned: (profile?.totalStudySessions || 0) >= 50 },
            { id: 'consistent', name: 'Consistent', icon: '📅', desc: '14-day study streak', earned: (profile?.streakDays || 0) >= 14 },
          ];
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {achievements.map(a => (
                <div key={a.id} className={`rounded-lg p-3 text-center ${a.earned ? 'bg-yellow-600/30 border border-yellow-500/40' : 'bg-gray-700/50 opacity-50'}`}>
                  <span className={`text-2xl ${a.earned ? '' : 'grayscale'}`}>{a.icon}</span>
                  <p className={`text-sm font-semibold mt-1 ${a.earned ? 'text-yellow-300' : 'text-gray-400'}`}>{a.name}</p>
                  <p className={`text-xs mt-1 ${a.earned ? 'text-yellow-200/70' : 'text-gray-500'}`}>{a.desc}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Usage Analytics */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Usage Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{studySessions.reduce((s, ss) => s + ss.messageCount, 0)}</p>
            <p className="text-xs text-gray-400">Total Messages</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{studySessions.length}</p>
            <p className="text-xs text-gray-400">Study Sessions</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{(() => {
              const dayCounts: Record<number, number> = {};
              studySessions.forEach(ss => {
                const day = new Date(ss.date).getDay();
                dayCounts[day] = (dayCounts[day] || 0) + 1;
              });
              const top = Object.entries(dayCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              return top ? days[Number(top[0])] : '-';
            })()}</p>
            <p className="text-xs text-gray-400">Most Active Day</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{(() => {
              const thisWeek = studySessions.filter(ss => {
                const d = new Date(ss.date).getTime();
                return Date.now() - d < 7 * 86400000;
              });
              return thisWeek.length;
            })()}</p>
            <p className="text-xs text-gray-400">This Week</p>
          </div>
        </div>
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
