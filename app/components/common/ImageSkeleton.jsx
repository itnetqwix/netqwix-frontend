import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * ImageSkeleton - Skeleton while an image loads; optional viewport-based deferral.
 * Does not swap to fallback on a timer (slow networks were incorrectly showing demo avatars).
 */
const ImageSkeleton = ({
  src,
  alt = '',
  className = '',
  style = {},
  fallbackSrc = '/assets/images/demoUser.png',
  lazy = true,
  priority = false,
  skeletonType = 'rounded',
  rootMargin = '120px',
  onLoad,
  onError,
  ...props
}) => {
  const shouldDefer = Boolean(src) && lazy && !priority;
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [imageSrc, setImageSrc] = useState(() =>
    src && !shouldDefer ? src : null
  );
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const getSkeletonRadius = () => {
    switch (skeletonType) {
      case 'circular':
        return '50%';
      case 'rounded':
        return '8px';
      case 'square':
        return '0';
      default:
        return '8px';
    }
  };

  const handleLoad = (e) => {
    setIsLoading(false);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    if (imageSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
    if (onError) onError(e);
  };

  useEffect(() => {
    if (!src) {
      setImageSrc(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (!lazy || priority) {
      setImageSrc(src);
      return;
    }

    setImageSrc(null);

    if (typeof IntersectionObserver === 'undefined') {
      setImageSrc(src);
      return;
    }

    const node = containerRef.current;
    if (!node) {
      setImageSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.disconnect();
          }
        });
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [src, lazy, priority, rootMargin]);

  // Cached / decoded images often fire `load` before React attaches `onLoad` — clear skeleton in that case.
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (!el || !imageSrc) return;
    if (el.complete && el.naturalHeight > 0) {
      setIsLoading(false);
    }
  }, [imageSrc]);

  return (
    <div
      ref={containerRef}
      className={`image-skeleton-container ${className}`}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {isLoading && (
        <div
          className="image-skeleton"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-loading 1.5s ease-in-out infinite',
            borderRadius: getSkeletonRadius(),
            zIndex: 1,
          }}
        />
      )}

      {imageSrc && (
        <img
          ref={imgRef}
          key={imageSrc}
          src={imageSrc}
          alt={alt}
          className={`image-skeleton-img ${isLoading ? 'image-loading' : 'image-loaded'}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out',
            borderRadius: getSkeletonRadius(),
            display: 'block',
            ...style,
          }}
          onLoad={handleLoad}
          onError={handleError}
          loading="eager"
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          {...props}
        />
      )}

      <style jsx>{`
        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .image-loading {
          opacity: 0;
        }
        .image-loaded {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default ImageSkeleton;
