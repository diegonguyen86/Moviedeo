import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiSearchPhim, formatMovieItem, deduplicateSeasons } from "../api/api";
import MovieCard from "./MovieCard";
import LoadingLogo from "./LoadingLogo";

export default function SearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"; // Prevent background scrolling
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setMovies([]);
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMovies([]);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await apiSearchPhim(debouncedQuery, 1); // Only fetch page 1 for quick preview
        let items = res?.data?.items || res?.items || [];
        items = deduplicateSeasons(items);
        setMovies(items.map(formatMovieItem).slice(0, 10)); // Giới hạn 10 phim trên popup
      } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col items-center animate-in fade-in duration-300">
      {/* Nút Đóng */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/20"
      >
        <span className="material-symbols-outlined text-[30px]">close</span>
      </button>

      <div className="w-full max-w-5xl px-6 mt-20 md:mt-32 flex flex-col items-center w-full h-full">
        
        {/* THANH TÌM KIẾM KHỔNG LỒ */}
        <div className="relative w-full mb-10 group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-white/40 text-[40px] group-focus-within:text-white transition-colors">search</span>
          <input 
            ref={inputRef}
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Bạn muốn xem phim gì hôm nay?"
            className="w-full bg-transparent border-b-2 border-white/20 focus:border-red-500 text-white placeholder-white/20 pl-20 pr-16 py-6 text-3xl md:text-5xl font-black outline-none transition-all" 
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full p-2 flex items-center">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          )}
        </div>

        {/* KẾT QUẢ TÌM KIẾM */}
        <div className="w-full flex-1 overflow-y-auto custom-scrollbar pb-20">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <LoadingLogo className="w-16 h-16" />
              <div className="mt-4 text-white/50 font-bold uppercase tracking-widest animate-pulse">Đang tìm kiếm...</div>
            </div>
          ) : movies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 w-full">
              {movies.map((movie) => (
                <div key={movie.id} onClick={onClose} className="transform transition-transform hover:scale-105">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          ) : query.trim() && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <span className="material-symbols-outlined text-6xl mb-4">sentiment_dissatisfied</span>
              <p className="font-bold uppercase tracking-widest text-center text-xl">Không tìm thấy phim "{query}"</p>
              <p className="text-sm mt-2">Vui lòng thử từ khóa khác!</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <span className="material-symbols-outlined text-[80px] mb-4">movie</span>
              <p className="font-bold uppercase tracking-widest text-center text-xl">Gõ tên phim để tìm kiếm ngay</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
