import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiSearchPhim, formatMovieItem, deduplicateSeasons } from "../api/api";

export default function SearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setDebouncedQuery("");
      setMovies([]);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Đóng bằng phím Esc
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

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

    let isCurrent = true; // Gõ nhanh: bỏ kết quả của từ khoá cũ trả về muộn
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await apiSearchPhim(debouncedQuery.trim(), 1);
        if (!isCurrent) return;
        let items = res?.data?.items || res?.items || [];
        items = deduplicateSeasons(items);
        setMovies(items.map(formatMovieItem).slice(0, 6)); // Giới hạn 6 phim cho dropdown nhỏ
      } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
        if (isCurrent) setMovies([]);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchResults();
    return () => { isCurrent = false; };
  }, [debouncedQuery]);

  // Đang chờ gõ xong (debounce) thì chưa kết luận "Không tìm thấy"
  const isTyping = query.trim() !== debouncedQuery.trim();

  const handleSelectMovie = (slug) => {
    onClose();
    navigate(`/movie/${slug}`);
  };

  if (!isOpen) return null;

  const isWaiting = loading || (isTyping && query.trim());

  return (
    <>
      {/* Vùng vô hình đóng popup khi bấm ra ngoài */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      {/* Điện thoại: cố định dưới header | Máy tính: thả xuống dưới nút tìm */}
      <div className="animate-fade-in fixed left-3 right-3 top-[68px] z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl md:absolute md:left-auto md:right-0 md:top-[calc(100%+8px)] md:w-[420px]">
        {/* Ô tìm */}
        <div className="relative border-b border-line">
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-fg-3">search</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && movies.length > 0) {
                handleSelectMovie(movies[0].id);
              }
            }}
            placeholder="Tìm tên phim, tên tiếng Anh…"
            aria-label="Tìm phim"
            className="h-13 w-full bg-transparent py-4 pl-12 pr-11 text-[15px] text-fg outline-none placeholder:text-fg-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-white/5 hover:text-fg" aria-label="Xoá chữ đã gõ">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Kết quả */}
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {isWaiting ? (
            <ul aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 p-2">
                  <div className="skeleton h-16 w-11 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className={`skeleton h-3 rounded-full ${["w-3/5", "w-2/5", "w-1/2"][i]}`} />
                    <div className="skeleton h-3 w-1/4 rounded-full" />
                  </div>
                </li>
              ))}
              <span className="sr-only" role="status">Đang tìm</span>
            </ul>
          ) : movies.length > 0 ? (
            <ul>
              {movies.map((movie) => (
                <li key={movie.id}>
                  <button
                    onClick={() => handleSelectMovie(movie.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <img
                      src={movie.image}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop";
                      }}
                      className="h-16 w-11 shrink-0 rounded-md bg-card object-cover ring-1 ring-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{movie.title}</p>
                      {movie.origin_name && movie.origin_name !== movie.title && (
                        <p className="truncate text-xs text-fg-2">{movie.origin_name}</p>
                      )}
                      <p className="mt-1 text-xs text-fg-3">{[movie.year, movie.quality, movie.lang].filter(Boolean).join(" · ")}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim() ? (
            <p className="px-4 py-8 text-center text-sm text-fg-2">Không tìm thấy phim “{query.trim()}”</p>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-fg-3">Gõ tên phim để tìm</p>
          )}
        </div>
      </div>
    </>
  );
}
