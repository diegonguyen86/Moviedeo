import { useEffect } from "react";

export default function TrailerModal({ isOpen, onClose, youtubeKey }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !youtubeKey) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90 md:right-4 md:top-4"
          aria-label="Đóng trailer"
          title="Đóng trailer"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        {/* referrerPolicy: cả web đặt <meta name="referrer" content="no-referrer"> (cho nguồn phim/ảnh),
            nhưng từ 2025 YouTube BẮT BUỘC có referrer -> thiếu là "Lỗi 153" không phát được.
            Riêng khung trailer gửi tên miền web (không gửi đường dẫn trang). */}
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0&playsinline=1`}
          title="Trailer"
          frameBorder="0"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${youtubeKey}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline sm:bottom-6"
      >
        Không phát được? Xem trên YouTube
      </a>
    </div>
  );
}
