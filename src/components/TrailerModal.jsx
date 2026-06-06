export default function TrailerModal({ isOpen, onClose, youtubeKey }) {
  if (!isOpen || !youtubeKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 md:top-4 md:right-4 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-red-600 text-white rounded-full transition-all"
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
