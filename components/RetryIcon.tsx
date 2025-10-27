import React from 'react';

const RetryIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5m-5-5l1.5 1.5A9 9 0 0120.5 11M20 20v-5h-5m5 5l-1.5-1.5A9 9 0 003.5 13" />
    </svg>
);

export default RetryIcon;
