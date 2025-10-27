

import React from 'react';

const LoadingDots: React.FC = () => (
  <div className="flex items-center space-x-1 py-2">
    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
  </div>
);

export default LoadingDots;