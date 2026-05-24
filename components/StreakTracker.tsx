import React from 'react';

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
}

const StreakTracker: React.FC<StreakTrackerProps> = ({ currentStreak, longestStreak, lastStudyDate }) => {
  const today = new Date().toISOString().split('T')[0];
  const isActiveToday = lastStudyDate === today;

  const encouragement = currentStreak === 0 ? 'Start your study streak today!' :
    currentStreak < 3 ? 'Keep going! Build your streak.' :
    currentStreak < 7 ? 'Great momentum! A week is within reach.' :
    currentStreak < 30 ? 'Amazing dedication! Keep it up!' :
    'Incredible faithfulness! You are an inspiration.';

  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="text-4xl">{currentStreak > 0 ? '🔥' : '📖'}</div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{currentStreak}</span>
            <span className="text-sm text-gray-400">day{currentStreak !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs text-gray-400">Study Streak</p>
        </div>
      </div>
      <p className="text-sm text-gray-300 mt-2">{encouragement}</p>
      <div className="flex justify-between mt-3 pt-2 border-t border-gray-600">
        <span className="text-xs text-gray-400">Longest: {longestStreak} days</span>
        <span className={`text-xs ${isActiveToday ? 'text-green-400' : 'text-yellow-400'}`}>
          {isActiveToday ? '✓ Studied today' : 'Study today to keep your streak!'}
        </span>
      </div>
    </div>
  );
};

export default StreakTracker;
