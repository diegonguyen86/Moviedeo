import { useRef } from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard";

export default function MovieCarousel({ title, movies, viewAllState }) {
  const rowRef = useRef(null);

  const scrollLeft = () => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: -rowRef.current.offsetWidth + 150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: rowRef.current.offsetWidth - 150, behavior: 'smooth' });
    }
  };

  return (
    <section className="mt-12 px-6 max-w-container-max mx-auto w-full relative group/carousel">
      
      <div className="flex items-end justify-between mb-6">
        {/* TIÊU ĐỀ NỔI BẬT HƠN (Đổi gạch dọc sang màu Trắng) */}
        <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter border-l-4 border-white pl-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          {title}
        </h3>
        
        {/* NÚT XEM TẤT CẢ TINH TẾ (Hover sang Trắng Sáng) */}
        {viewAllState && (
          <Link 
            to="/search"
            state={viewAllState}
            className="text-zinc-400 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 group mb-1"
          >
            Xem tất cả
            <span className="material-symbols-outlined text-[16px] bg-white/10 rounded-full p-1 group-hover:bg-white group-hover:text-black transition-all shadow-[0_0_10px_rgba(255,255,255,0)] group-hover:shadow-[0_0_15px_rgba(255,255,255,0.6)]">
              arrow_forward
            </span>
          </Link>
        )}
      </div>
      
      <div className="relative">
        {/* MŨI TÊN TRÁI - TO HƠN, KÍNH MỜ TRẮNG SÁNG */}
        <button 
          onClick={scrollLeft}
          className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-14 h-14 bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] border border-white/10 cursor-pointer hidden md:flex"
        >
          <span className="material-symbols-outlined text-3xl">chevron_left</span>
        </button>

        <div 
          ref={rowRef}
          className="flex gap-4 md:gap-5 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory pt-2 pb-8"
        >
          {movies.map((movie) => (
            <div key={movie.id} className="w-[140px] md:w-[180px] lg:w-[200px] shrink-0 snap-start">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>

        {/* MŨI TÊN PHẢI - TO HƠN, KÍNH MỜ TRẮNG SÁNG */}
        <button 
          onClick={scrollRight}
          className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-14 h-14 bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] border border-white/10 cursor-pointer hidden md:flex"
        >
          <span className="material-symbols-outlined text-3xl">chevron_right</span>
        </button>
      </div>
    </section>
  );
}