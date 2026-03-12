import { useRef, useEffect } from 'react';

/** Calls `callback` on every animation frame while mounted. */
export function useAnimationFrame(callback: () => void): void {
  const callbackRef = useRef(callback);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const loop = () => {
      callbackRef.current();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
}
