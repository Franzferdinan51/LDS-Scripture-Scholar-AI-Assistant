import React, { useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ src, alt }) => {
  const [error, setError] = useState(false);

  const handleError = () => {
    setError(true);
  };

  // Use a reliable image proxy to bypass hotlinking/CORS issues.
  const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(src)}`;

  if (error) {
    return (
      <div className="my-2 p-3 rounded-lg border border-red-500/50 bg-red-800/30 text-red-200">
        <p className="font-semibold text-sm">Image failed to load</p>
        <p className="text-xs mt-1">The bot provided an image, but it couldn't be displayed. It may be an invalid link or blocked by the source.</p>
        <a 
          href={src} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline mt-2 inline-block break-all"
        >
          (View Original Source)
        </a>
      </div>
    );
  }

  return (
    <img
      src={proxyUrl}
      alt={alt}
      className="mt-2 mb-2 rounded-lg max-w-full h-auto shadow-md"
      onError={handleError}
    />
  );
};

export default ImageWithFallback;