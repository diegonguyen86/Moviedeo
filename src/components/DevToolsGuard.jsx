import { useEffect, useState } from 'react';

export default function DevToolsGuard() {
  const [isBlackout, setIsBlackout] = useState(false);

  useEffect(() => {
    // Nhận diện thiết bị di động / máy tính bảng (màn hình cảm ứng)
    const isTouchOrMobile = () => {
      return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches
      );
    };

    const isMobile = isTouchOrMobile();

    // 1. Ghi đè console để bảo vệ API và đường dẫn không bị soi
    const noop = () => {};
    ['log', 'debug', 'info', 'warn', 'table', 'trace', 'dir'].forEach((method) => {
      try {
        console[method] = noop;
      } catch (e) {}
    });

    const triggerBlackout = () => {
      setIsBlackout(true);
      try { console.clear(); } catch(e) {}
    };

    const restoreNormal = () => {
      setIsBlackout(false);
    };

    // 2. Chặn chuột phải (Inspect Element / Context Menu)
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 3. Chặn các phím F12, Ctrl+Shift+I/J/C, Ctrl+U (và Cmd tương đương trên Mac)
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout();
        return false;
      }

      // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (hoặc Cmd trên Mac)
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey)) {
        const key = (e.key || '').toUpperCase();
        if (key === 'I' || key === 'J' || key === 'C') {
          e.preventDefault();
          e.stopPropagation();
          triggerBlackout();
          return false;
        }
      }

      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout();
        return false;
      }
    };

    // 4. Phát hiện mở DevTools bằng kích thước cửa sổ (CHỈ CHẠY TRÊN PC CÓ CHUỘT)
    // Tuyệt đối không chạy trên điện thoại vì thanh địa chỉ/xoay màn hình/fullscreen làm lệch kích thước
    const checkWindowSize = () => {
      if (isMobile) return;

      const threshold = 180;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        triggerBlackout();
      } else {
        // Tự động khôi phục nếu người dùng đã đóng DevTools trên PC
        restoreNormal();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);

    let timer = null;
    if (!isMobile) {
      window.addEventListener('resize', checkWindowSize);
      timer = setInterval(checkWindowSize, 800);
    }

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (!isMobile) {
        window.removeEventListener('resize', checkWindowSize);
        if (timer) clearInterval(timer);
      }
    };
  }, []);

  if (!isBlackout) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: '#09090b',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }} 
    >
      <div style={{ maxWidth: '480px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#f43f5e' }}>
          Đã phát hiện công cụ kiểm tra (DevTools)
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
          Vui lòng đóng cửa sổ DevTools (Inspect) hoặc nhấn F12 để tiếp tục thưởng thức phim nhé!
        </p>
        <button
          onClick={() => setIsBlackout(false)}
          style={{
            padding: '10px 24px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontWeight: 'bold',
            fontSize: '13px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Tôi đã đóng DevTools
        </button>
      </div>
    </div>
  );
}
