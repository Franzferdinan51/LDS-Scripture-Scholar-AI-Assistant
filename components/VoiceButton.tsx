


import React from 'react';

interface VoiceButtonProps {
    isActive: boolean;
    isConnecting: boolean;
    onClick: () => void;
}

const MicrophoneIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 2a3 3 0 00-3 3v4a3 3 0 006 0V5a3 3 0 00-3-3z" />
      <path d="M4 10a1 1 0 00-1 1v1a6 6 0 006 6v2a1 1 0 102 0v-2a6 6 0 006-6v-1a1 1 0 10-2 0v1a4 4 0 01-8 0v-1a1 1 0 00-1-1z" />
    </svg>
);

const StopIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


const VoiceButton: React.FC<VoiceButtonProps> = ({ isActive, isConnecting, onClick }) => {

    const getButtonClasses = () => {
        if (isActive) {
            return "bg-red-500 hover:bg-red-600";
        }
        if (isConnecting) {
            return "bg-blue-500 animate-pulse";
        }
        return "bg-blue-600 hover:bg-blue-700";
    };

    const getTitle = () => {
        if (isActive) return "Stop voice chat";
        if (isConnecting) return "Connecting...";
        return "Start voice chat";
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isConnecting}
            className={`text-white rounded-full p-2 sm:p-3 disabled:cursor-wait transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-50 ${getButtonClasses()}`}
            aria-label={getTitle()}
            title={getTitle()}
        >
            {isConnecting ? (
                <div className="w-5 h-5"></div> // Placeholder for size
            ) : isActive ? (
                <StopIcon />
            ) : (
                <MicrophoneIcon />
            )}
        </button>
    );
};

export default VoiceButton;