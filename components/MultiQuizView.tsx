import React, { useState } from 'react';
import type { MultiQuiz } from '../types';

interface MultiQuizViewProps {
  quiz: MultiQuiz;
  messageId: string;
  onAnswer: (messageId: string, questionIndex: number, answerIndex: number) => void;
}

const MultiQuizView: React.FC<MultiQuizViewProps> = ({ quiz, messageId, onAnswer }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const hasAnsweredCurrent = currentQuestion?.userAnswerIndex !== undefined;

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };
  
  const handleRestart = () => {
    // This would require clearing answers in the parent state, which is complex.
    // For now, we'll just reset the view. A full reset would need prop drilling.
    setCurrentQuestionIndex(0);
    setShowResults(false);
    // Note: answers are still stored in the message state.
  };

  if (showResults) {
    const score = quiz.questions.filter(q => q.userAnswerIndex === q.correctAnswerIndex).length;
    return (
      <div className="mt-2 border-t border-slate-600/50 pt-3 text-center">
        <h3 className="text-lg font-bold text-gray-100 mb-2">Quiz Complete!</h3>
        <p className="text-2xl font-bold">You scored {score} out of {quiz.questions.length}</p>
         <button 
          onClick={handleRestart}
          className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-slate-600/50 pt-3">
      <h3 className="text-lg font-bold text-gray-100 mb-1">{quiz.title}</h3>
      <p className="text-sm text-gray-400 mb-3">Question {currentQuestionIndex + 1} of {quiz.questions.length}</p>

      <div className="bg-slate-700/50 rounded-lg p-3">
        <p className="font-semibold mb-3">{currentQuestion.question}</p>
        <div className="flex flex-col space-y-2">
          {currentQuestion.options.map((option, index) => {
            let buttonClasses = 'w-full text-left p-2 rounded-md border transition-colors disabled:opacity-80 disabled:cursor-not-allowed';
            if (hasAnsweredCurrent) {
              if (index === currentQuestion.correctAnswerIndex) {
                buttonClasses += ' bg-green-500 border-green-600 text-white';
              } else if (index === currentQuestion.userAnswerIndex) {
                buttonClasses += ' bg-red-500 border-red-600 text-white';
              } else {
                buttonClasses += ' border-slate-600 bg-slate-700/50 text-gray-300';
              }
            } else {
              buttonClasses += ' border-slate-600 bg-slate-700/50 hover:bg-slate-600/50 text-gray-200';
            }
            return (
              <button
                key={index}
                onClick={() => onAnswer(messageId, currentQuestionIndex, index)}
                disabled={hasAnsweredCurrent}
                className={buttonClasses}
              >
                {typeof option === 'string' ? option : option.text}
              </button>
            );
          })}
        </div>
      </div>
      
      {hasAnsweredCurrent && (
        <div className="mt-3 text-right">
           <button 
             onClick={handleNext}
             className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
                {currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'Show Results'}
            </button>
        </div>
      )}
    </div>
  );
};

export default MultiQuizView;