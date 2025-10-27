import React from 'react';

const ThinkingIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className || "h-5 w-5"} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M3 5V19"></path>
    <ellipse cx="12" cy="19" rx="9" ry="3"></ellipse>
    <ellipse transform="rotate(60 12 12)" cx="12" cy="12" rx="9" ry="3"></ellipse>
    <ellipse transform="rotate(120 12 12)" cx="12" cy="12" rx="9" ry="3"></ellipse>
  </svg>
);

export default ThinkingIcon;