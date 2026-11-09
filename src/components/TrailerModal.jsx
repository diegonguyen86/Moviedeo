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
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
