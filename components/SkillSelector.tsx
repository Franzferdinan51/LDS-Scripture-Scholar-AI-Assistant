import React, { useEffect } from 'react';
import type { Skill } from '../types';

interface SkillSelectorProps {
  skills: Skill[];
  activeSkillId: string | null;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
}

const SKILL_ICONS: Record<string, string> = {
  'scripture-deep-dive': '📖',
  'topical-study': '🔍',
  'character-study': '👤',
  'timeline-builder': '📅',
  'parallel-passage-finder': '🔗',
  'lesson-prep': '📝',
  'fhe-planner': '🏠',
  'daily-study': '☀️',
  'memorization-helper': '🧠',
  'conference-talk-finder': '🎤',
};

const SkillSelector: React.FC<SkillSelectorProps> = ({ skills, activeSkillId, onSelect, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Skills</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => { onSelect(skill); onClose(); }}
              className={`p-4 rounded-lg text-left transition-all ${
                activeSkillId === skill.id
                  ? 'bg-blue-600 ring-2 ring-blue-400'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">{SKILL_ICONS[skill.id] || '✨'}</div>
              <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
              <p className="text-xs text-gray-300 mt-1 line-clamp-2">{skill.description}</p>
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-gray-600 text-gray-300">{skill.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkillSelector;
