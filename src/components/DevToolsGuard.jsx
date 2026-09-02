import { useEffect, useState } from 'react';

export default function DevToolsGuard() {
  const [isBlackout, setIsBlackout] = useState(false);

  useEffect(() => {
    // 1. Ghi đè toàn bộ hàm console để không xuất log và xóa console
    const noop = () => {};
    ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir'].forEach((method) => {
      try {
        console[method] = noop;
      } catch (e) {}
    });

    const triggerFreezeAndBlackout = () => {
      setIsBlackout(true);
      
      // Xóa sạch console liên tục
      try { console.clear(); } catch(e) {}
      
      // Ẩn toàn bộ nội dung DOM của website để chống soi Elements
      try {
        const root = document.getElementById('root');
        if (root) root.style.display = 'none';
        document.body.style.backgroundColor = '#000000';
      } catch(e) {}

      // Vòng lặp debugger vô tận để đóng băng (Freeze / Trap) DevTools
      setInterval(() => {
        try {
          (function() { return false; }["constructor"]("debugger")());
        } catch(e) {}
      }, 50);
    };

    // 2. Chặn chuột phải (Inspect Element)
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 3. Chặn các phím F12, Ctrl+Shift+I/J/C, Ctrl+U
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerFreezeAndBlackout();
        return false;
      }

      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (hoặc Cmd trên Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const key = (e.key || '').toUpperCase();
        if (key === 'I' || key === 'J' || key === 'C') {
          e.preventDefault();
          e.stopPropagation();
          triggerFreezeAndBlackout();
          return false;
        }
      }

      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerFreezeAndBlackout();
        return false;
      }
    };

    // 4. Phát hiện mở DevTools bằng Timing Check (Debugger Benchmark)
    const detectTiming = () => {
      const startTime = performance.now();
      try {
        (function() { return false; }["constructor"]("debugger")());
      } catch(e) {}
      const endTime = performance.now();
      if (endTime - startTime > 80) {
        triggerFreezeAndBlackout();
      }
    };

    // 5. Phát hiện mở DevTools bằng kích thước cửa sổ
    const checkWindowSize = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        triggerFreezeAndBlackout();
      }
    };

    // 6. Phát hiện mở Console qua Object Getter
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function() {
        triggerFreezeAndBlackout();
      }
    });

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', checkWindowSize);

    const timer = setInterval(() => {
      detectTiming();
      checkWindowSize();
      try {
        console.log('%c', element);
        console.clear();
      } catch(e) {}
    }, 500);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', checkWindowSize);
      clearInterval(timer);
    };
  }, []);

  if (!isBlackout) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: '#000000',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'all'
      }} 
    />
  );
}
