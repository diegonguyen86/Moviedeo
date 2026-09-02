import { useEffect, useState } from 'react';

export default function DevToolsGuard() {
  const [isBlackout, setIsBlackout] = useState(false);

  useEffect(() => {
    // 1. Vô hiệu hóa các hàm console trong trình duyệt
    const noop = () => {};
    const originalConsole = { ...console };
    
    ['log', 'debug', 'info', 'warn'].forEach((method) => {
      try {
        console[method] = noop;
      } catch (e) {}
    });

    // 2. Chặn chuột phải (Inspect element)
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // 3. Chặn các tổ hợp phím F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        setIsBlackout(true);
        return false;
      }

      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (hoặc Cmd trên Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const key = e.key.toUpperCase();
        if (key === 'I' || key === 'J' || key === 'C') {
          e.preventDefault();
          e.stopPropagation();
          setIsBlackout(true);
          return false;
        }
      }

      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        setIsBlackout(true);
        return false;
      }
    };

    // 4. Phát hiện mở DevTools thông qua kích thước cửa sổ
    const checkDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        setIsBlackout(true);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', checkDevTools);

    const interval = setInterval(checkDevTools, 1000);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', checkDevTools);
      clearInterval(interval);
    };
  }, []);

  if (!isBlackout) return null;

  return (
    <div className="fixed inset-0 z-[9999999] bg-black flex flex-col items-center justify-center p-6 text-center select-none cursor-not-allowed">
      {/* Màn hình đen hoàn toàn */}
    </div>
  );
}
