import React, { useEffect, useRef } from 'react';
import type { Skill } from '../types';

interface SkillSelectorProps {
  skills: Skill[];
  activeSkillId: string | null;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
}

const SKILL_ICONS: Record<string, string> = {
  'scripture-deep-dive': '\u{1F4D6}',
  'topical-study': '\u{1F50D}',
  'character-study': '\u{1F464}',
  'timeline-builder': '\u{1F4C5}',
  'parallel-passage-finder': '\u{1F517}',
  'lesson-prep': '\u{1F4DD}',
  'fhe-planner': '\u{1F3E0}',
  'daily-study': '\u2600\uFE0F',
  'memorization-helper': '\u{1F9E0}',
  'conference-talk-finder': '\u{1F3A4}',
};

const SkillSelector: React.FC<SkillSelectorProps> = ({ skills, activeSkillId, onSelect, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirstButton = () => {
      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusableElements?.[0]?.focus();
    };

    const timer = window.setTimeout(focusFirstButton, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        if (activeElement === firstElement || !modalRef.current?.contains(activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else if (activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skills-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="skills-title" className="text-xl font-bold text-white">Skills</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl" aria-label="Close skills">&times;</button>
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
              <div className="text-2xl mb-2" aria-hidden="true">{SKILL_ICONS[skill.id] || '\u2728'}</div>
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
