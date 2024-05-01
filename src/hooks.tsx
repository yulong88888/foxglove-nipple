import throttle from "lodash/throttle";
import React, { useEffect, useMemo, useRef } from "react";

// Define the hook with generic types to ensure it works with any callback signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const callbackRef = useRef<T>(callback);

  // Update the current callback to ensure it has the latest values/closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Initialize and cleanup the throttled function
  const throttledCallback = useMemo(() => {
    return throttle((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  useEffect(() => {
    // Cleanup function
    return () => {
      throttledCallback.cancel();
    };
  }, [throttledCallback]);

  return throttledCallback;
}

export const useMountEffect = (fun: React.EffectCallback): void => React.useEffect(fun, [fun]);
