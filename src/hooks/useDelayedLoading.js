import { useEffect, useRef, useState } from "react";

// Hiện cờ đang tải sau delayMs; đã hiện thì giữ ít nhất minVisibleMs (evon loading.md).
// Dữ liệu về nhanh dưới 300ms thì không chớp khung chờ.
export function useDelayedLoading(isLoading, delayMs = 300, minVisibleMs = 500) {
  const [isVisible, setIsVisible] = useState(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (isLoading) {
      if (isVisible) return;
      const showTimer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setIsVisible(true);
      }, delayMs);
      return () => window.clearTimeout(showTimer);
    }
    if (!isVisible) return;
    const remainingMs = Math.max(0, minVisibleMs - (Date.now() - shownAtRef.current));
    const hideTimer = window.setTimeout(() => setIsVisible(false), remainingMs);
    return () => window.clearTimeout(hideTimer);
  }, [isLoading, isVisible, delayMs, minVisibleMs]);

  return isVisible;
}
