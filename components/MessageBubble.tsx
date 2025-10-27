import React, { Fragment, useState, useRef, useEffect } from 'react';
import type { Message } from '../types';
import LoadingDots from './LoadingDots';
import ImageWithFallback from './ImageWithFallback';
import SpeakerIcon from './SpeakerIcon';
import PauseIcon from './PauseIcon';
import ExplainIcon from './ExplainIcon';
import MapIcon from './MapIcon';
import WebIcon from './WebIcon';
import CopyIcon from './CopyIcon';
import CheckIcon from './CheckIcon';
import StudyPlanView from './StudyPlanView';
import MultiQuizView from './MultiQuizView';
import LightbulbIcon from './LightbulbIcon';
import RetryIcon from './RetryIcon';

interface AudioPlaybackState {
  messageId: string | null;
  status: 'playing' | 'paused' | 'stopped' | 'loading';
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onToggleAudio: (messageId: string, text: string) => Promise<void>;
  audioPlaybackState: AudioPlaybackState;
  onAnswerQuiz: (messageId: string, questionIndex: number, answerIndex: number) => void;
  onExplainVerse: (verse: string) => void;
  onRetry: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming = false, onToggleAudio, audioPlaybackState, onAnswerQuiz, onExplainVerse, onRetry }) => {
  const isUser = message.sender === 'user';
  const [copied, setCopied] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (isStreaming && message.thinking && detailsRef.current && !detailsRef.current.open) {
      detailsRef.current.open = true;
    }
  }, [isStreaming, message.thinking]);

  const handleAudioToggle = async () => {
    // Collect all text content for TTS, excluding structured data like quizzes
    let textToSpeak = message.text;
    if (message.studyPlan) {
        textToSpeak = `Here is your study plan on ${message.studyPlan.title}. I have sent the details in the chat.`;
    }
    if (message.multiQuiz) {
        textToSpeak = `Here is your quiz on ${message.multiQuiz.title}. Good luck!`;
    }
    await onToggleAudio(message.id, textToSpeak);
  }
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(message.text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    });
  };

  if (message.isSuggestion) {
    return (
      <div className="flex items-center gap-2 md:gap-3 my-2 mx-auto max-w-lg md:max-w-xl lg:max-w-2xl">
        <div className="flex-shrink-0">
            <LightbulbIcon className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="text-sm italic text-gray-400 border-l-2 border-yellow-500/50 pl-3">
          {message.text}
        </div>
      </div>
    );
  }

  const bubbleClasses = isUser
    ? 'bg-blue-600 text-white rounded-br-none'
    : 'bg-slate-800/70 backdrop-blur-sm text-gray-100 rounded-bl-none';
  
  const containerClasses = isUser ? 'justify-end' : 'justify-start';

  // This regex finds scripture references like "1 Nephi 3:7", "Alma 32:21-28", or "Doctrine and Covenants 76:22–24"
  const scriptureRegex = /\b([1-3]\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+:\d+(?:–\d+)?(?:,\s*\d+(?:–\d+)?)*\b/g;

  const renderTextWithFeatures = (text: string) => {
    const parts = text.split(scriptureRegex);
    const matches = text.match(scriptureRegex) || [];
    
    return parts.map((part, index) => (
      <Fragment key={index}>
        {part}
        {matches[index] && (
          <span className="inline-flex items-center">
            <a 
              href="#"
              onClick={(e) => { e.preventDefault(); onExplainVerse(matches[index]); }}
              className="font-semibold text-blue-400 underline decoration-dotted hover:text-blue-300"
            >
              {matches[index]}
            </a>
            <button 
              onClick={() => onExplainVerse(matches[index])} 
              className="ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
              title={`Explain ${matches[index]}`}
            >
              <ExplainIcon className="w-4 h-4" />
            </button>
          </span>
        )}
      </Fragment>
    ));
  };
  
  const renderUserText = (text:string) => {
     return text.split(scriptureRegex).map((part, index) => {
      const matches = text.match(scriptureRegex) || [];
      return (
        <Fragment key={index}>
          {part}
          {matches[index] && (
             <span className="font-semibold">{matches[index]}</span>
          )}
        </Fragment>
      )
     });
  }

  const renderContent = (text: string) => {
    const imageRegex = /!\[(.*?)]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imageRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textSegment = text.substring(lastIndex, match.index);
        parts.push(
          <div key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {isUser ? renderUserText(textSegment) : renderTextWithFeatures(textSegment)}
          </div>
        );
      }
      const [, alt, src] = match;
      parts.push(<ImageWithFallback key={`img-${match.index}`} src={src} alt={alt} />);
      lastIndex = imageRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(
        <div key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {isUser ? renderUserText(remainingText) : renderTextWithFeatures(remainingText)}
        </div>
      );
    }
    
    if (parts.length === 0 && text) {
      return <div className="whitespace-pre-wrap">{isUser ? renderUserText(text) : renderTextWithFeatures(text)}</div>;
    }

    return parts;
  };

  const isCurrentMessagePlaying = audioPlaybackState.messageId === message.id && audioPlaybackState.status === 'playing';
  const isCurrentMessageLoading = audioPlaybackState.messageId === message.id && audioPlaybackState.status === 'loading';

  const shouldRenderAudioButton = !isUser && (message.text || message.studyPlan || message.multiQuiz);
  
  const hasContent = message.text || message.quiz || message.multiQuiz || message.studyPlan;
  
  return (
    <div className={`flex items-end space-x-2 ${containerClasses} w-full group`}>
      <div className={`rounded-2xl py-3 px-4 max-w-lg md:max-w-xl lg:max-w-2xl shadow-md ${bubbleClasses}`}>
        {!hasContent && !isUser ? (
          <LoadingDots />
        ) : (
          <>
            {renderContent(message.text)}
            {message.studyPlan && <StudyPlanView studyPlan={message.studyPlan} />}
            {message.multiQuiz && <MultiQuizView quiz={message.multiQuiz} messageId={message.id} onAnswer={onAnswerQuiz} />}
          </>
        )}
        {message.thinking && (
          <details ref={detailsRef} className="mt-3 pt-3 border-t border-white/20 text-xs">
            <summary className="cursor-pointer text-gray-400 font-semibold select-none list-none flex items-center gap-1">
              Show Thought Process
              <svg className="w-4 h-4 transition-transform transform details-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-700">
              <pre className="whitespace-pre-wrap font-mono text-gray-300 break-words">{message.thinking}</pre>
            </div>
            <style>{`
                details > summary::-webkit-details-marker { display: none; }
                details[open] > summary .details-arrow { transform: rotate(180deg); }
            `}</style>
          </details>
        )}
        {message.groundingChunks && message.groundingChunks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-xs font-semibold text-gray-400 mb-2">Sources:</p>
            <div className="flex flex-col space-y-2">
              {message.groundingChunks.map((chunk, index) => {
                const source = chunk.web || chunk.maps;
                if (!source || !source.uri) return null;
                return (
                   <a 
                    href={source.uri} 
                    key={index}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-blue-400 hover:underline truncate flex items-center gap-2"
                  >
                    {chunk.web ? <WebIcon className="w-3 h-3 flex-shrink-0" /> : <MapIcon className="w-3 h-3 flex-shrink-0" />}
                    <span className="truncate">{source.title || source.uri}</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 self-end">
        {!isUser && hasContent && !message.isSuggestion && (
             <button 
              onClick={() => onRetry(message.id)} 
              className="p-1.5 rounded-full text-gray-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Retry answer"
              title="Retry answer"
            >
              <RetryIcon className="w-5 h-5" />
            </button>
        )}
        {!isUser && message.text && (
             <button 
              onClick={handleCopyToClipboard} 
              className="p-1.5 rounded-full text-gray-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
              aria-label={copied ? "Copied!" : "Copy text"}
              title={copied ? "Copied!" : "Copy text"}
            >
              {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
            </button>
        )}
        {shouldRenderAudioButton && (
            <button 
            onClick={handleAudioToggle} 
            disabled={isCurrentMessageLoading}
            className="p-1.5 rounded-full text-gray-400 hover:bg-white/10 disabled:opacity-50 disabled:cursor-wait transition-colors"
            aria-label={isCurrentMessagePlaying ? "Pause audio" : "Play message audio"}
            >
            {isCurrentMessageLoading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            ) : isCurrentMessagePlaying ? (
                <PauseIcon className="w-5 h-5" />
            ) : (
                <SpeakerIcon className="w-5 h-5" />
            )}
            </button>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;