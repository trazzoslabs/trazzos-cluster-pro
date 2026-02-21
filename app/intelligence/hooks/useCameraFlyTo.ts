import { useState, useRef, useCallback } from 'react';

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface CameraBookmark {
  x: number;
  y: number;
  zoom: number;
}

export function useCameraFlyTo(initialState: CameraState) {
  const [camera, setCamera] = useState<CameraState>(initialState);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const bookmarkRef = useRef<CameraBookmark | null>(null);
  const animationRef = useRef<number | null>(null);

  const saveBookmark = useCallback(() => {
    bookmarkRef.current = { ...camera };
  }, [camera]);

  const flyTo = useCallback((targetX: number, targetY: number, targetZoom: number = 1.5, duration: number = 900) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setIsTransitioning(true);
    saveBookmark();

    const startX = camera.x;
    const startY = camera.y;
    const startZoom = camera.zoom || 1;
    const startTime = performance.now();

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      const newX = startX + (targetX - startX) * eased;
      const newY = startY + (targetY - startY) * eased;
      const newZoom = startZoom + (targetZoom - startZoom) * eased;

      setCamera({ x: newX, y: newY, zoom: newZoom });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsTransitioning(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [camera, saveBookmark]);

  const flyBack = useCallback((duration: number = 900) => {
    if (!bookmarkRef.current) return;

    flyTo(
      bookmarkRef.current.x,
      bookmarkRef.current.y,
      bookmarkRef.current.zoom,
      duration
    );
  }, [flyTo]);

  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsTransitioning(false);
    bookmarkRef.current = null;
  }, []);

  return {
    camera,
    isTransitioning,
    flyTo,
    flyBack,
    reset,
    saveBookmark,
  };
}




