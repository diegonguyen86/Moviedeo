import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiSearchPhim, formatMovieItem, deduplicateSeasons } from "../api/api";
import LoadingLogo from "./LoadingLogo";

export default function SearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setMovies([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMovies([]);
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await apiSearchPhim(debouncedQuery, 1); 
        let items = res?.data?.items || res?.items || [];
        items = deduplicateSeasons(items);
        setMovies(items.map(formatMovieItem).slice(0, 6)); // Giới hạn 6 phim cho dropdown nhỏ
      } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  const getFullImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `https://phimimg.com/${url}`;
  };

  const handleSelectMovie = (slug) => {
    onClose();
    navigate(`/movie/${slug}`);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Vùng vô hình đóng popup khi click ra ngoài */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      {/* MOBILE: fixed top-20 left-4 right-4 | PC: absolute right-0 top-120% */}
      <div className="fixed md:absolute right-4 left-4 md:left-auto md:right-0 top-[80px] md:top-[120%] md:mt-2 w-auto md:w-[400px] bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-200">
        
        {/* Ô Nhập Liệu */}
        <div className="relative border-b border-white/10">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]">search</span>
          <input 
            ref={inputRef}
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Tìm kiếm phim..."
            className="w-full bg-transparent text-white placeholder-zinc-500 pl-12 pr-10 py-4 text-sm font-bold outline-none" 
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Kết quả trả về */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <LoadingLogo className="w-8 h-8" />
            </div>
          ) : movies.length > 0 ? (
            <div className="flex flex-col p-2 gap-1">
              {movies.map((movie) => (
                <button 
                  key={movie.id} 
                  onClick={() => handleSelectMovie(movie.slug)} 
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <img src={getFullImageUrl(movie.thumb_url)} alt={movie.name} className="w-12 h-16 object-cover rounded-md shadow-md" />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-white text-sm font-bold truncate">{movie.name}</h4>
                    <p className="text-zinc-400 text-xs truncate">{movie.origin_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-black bg-white px-1.5 py-0.5 rounded-sm">{movie.year}</span>
                      <span className="text-[10px] font-bold text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded-sm uppercase">{movie.quality}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() && !loading ? (
            <div className="py-8 text-center text-zinc-500 text-sm font-bold">
              Không tìm thấy phim "{query}"
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-600 text-xs font-bold uppercase tracking-widest">
              Nhập từ khoá để tìm kiếm
            </div>
          )}
        </div>
      </div>
    </>
  );
}
