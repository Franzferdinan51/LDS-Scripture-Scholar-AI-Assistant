import React from 'react';

const MapIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707l6 6a1 1 0 001.414 0l6-6A1 1 0 0018 14V4a1 1 0 00-.707-.707l-6-6a1 1 0 00-1.414 0l-6 6z" clipRule="evenodd" />
    </svg>
);

export default MapIcon;