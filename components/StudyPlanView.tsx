import React from 'react';
import type { StudyPlan } from '../types';

interface StudyPlanViewProps {
  studyPlan: StudyPlan;
}

const StudyPlanView: React.FC<StudyPlanViewProps> = ({ studyPlan }) => {
  if (!studyPlan || !Array.isArray(studyPlan.days) || studyPlan.days.length === 0) {
    return (
      <div className="mt-2 border-t border-slate-600/50 pt-3 text-yellow-400">
        Could not generate a valid study plan. The AI may have returned an unexpected format. Please try again.
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-slate-600/50 pt-3">
      <h3 className="text-lg font-bold text-gray-100 mb-2">{studyPlan.title}</h3>
      <div className="space-y-2">
        {studyPlan.days.map((day, index) => (
          <details key={index} className="bg-slate-700/50 rounded-lg p-3 transition-all open:ring-1 open:ring-blue-500/50">
            <summary className="font-semibold text-gray-200 cursor-pointer list-none flex justify-between items-center">
              Day {day.day}: {day.topic}
              <svg className="w-5 h-5 transition-transform transform details-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3 text-sm text-gray-300 space-y-3 pl-2 border-l-2 border-slate-600">
                <div>
                    <p className="font-semibold text-gray-200 mb-1">Key Scriptures:</p>
                    <ul className="list-disc list-inside space-y-1">
                        {day.scriptures.map(s => <li key={s}>{s}</li>)}
                    </ul>
                </div>
                 <div>
                    <p className="font-semibold text-gray-200 mb-1">Reflection Question:</p>
                    <p className="italic">"{day.reflection_question}"</p>
                </div>
            </div>
          </details>
        ))}
      </div>
      <style>{`
        details > summary { -webkit-user-select: none; user-select: none; }
        details[open] > summary .details-arrow { transform: rotate(180deg); }
      `}</style>
    </div>
  );
};

export default StudyPlanView;