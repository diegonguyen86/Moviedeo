import { useState, useEffect } from "react";

// Lời chào hiện một lần mỗi phiên lướt web (sessionStorage): tắt tab mở lại thì hiện lại.
export default function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("has_seen_welcome_popup")) return;
    const timer = setTimeout(() => setIsOpen(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleClose = () => {
    sessionStorage.setItem("has_seen_welcome_popup", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="animate-fade-in w-full max-w-md overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-28 overflow-hidden">
          <img src="/cute-bg.jpg" alt="" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-raised to-transparent" />
        </div>
        <div className="px-6 pb-6">
          <h2 id="welcome-title" className="text-xl font-semibold tracking-tight text-fg">Chào các ní iu! 👋</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
            Web làm ra <span className="font-medium text-fg">phi lợi nhuận</span> và <span className="font-medium text-fg">không gắn bất kỳ quảng cáo nào</span>.
          </p>
          <p className="mt-3 rounded-xl bg-white/[0.05] px-3.5 py-3 text-sm leading-relaxed text-fg-2">
            Nếu thấy quảng cáo trong phim thì đó là từ nguồn phát gốc, web của tui không kiếm được đồng nào từ đó đâu nha 🥺 Chúc các ní xem phim vui vẻ!
          </p>
          <button
            onClick={handleClose}
            autoFocus
            className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-fg text-[15px] font-semibold text-canvas transition-colors hover:bg-white"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
