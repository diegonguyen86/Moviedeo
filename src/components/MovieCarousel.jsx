import { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import MovieCard from "./MovieCard";

export default function MovieCarousel({ title, movies, viewAllState, isTop10 = false, startNumber = 1 }) {
  const rowRef = useRef(null);
  const navigate = useNavigate();
  const [isAtEnd, setIsAtEnd] = useState(false);

  // Drag to scroll states
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [dragDistance, setDragDistance] = useState(0);

  const handleScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      const atEnd = Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 10;
      setIsAtEnd(atEnd);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [movies]);

  const scrollLeft = () => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: -rowRef.current.clientWidth * 0.8, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (rowRef.current) {
      if (isAtEnd) {
        if (isTop10) {
          rowRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (viewAllState) {
          navigate('/search', { state: viewAllState });
        }
      } else {
        rowRef.current.scrollBy({ left: rowRef.current.clientWidth * 0.8, behavior: 'smooth' });
      }
    }
  };

  // Drag to scroll handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - rowRef.current.offsetLeft);
    setScrollLeftState(rowRef.current.scrollLeft);
    setDragDistance(0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - rowRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Tốc độ cuộn (nhân 1.5 để mượt hơn)
    setDragDistance(Math.abs(walk));
    rowRef.current.scrollLeft = scrollLeftState - walk;
  };

  const handleClickCapture = (e) => {
    if (dragDistance > 5) {
      e.stopPropagation();
      e.preventDefault();
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
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragStart={(e) => e.preventDefault()}
          onClickCapture={handleClickCapture}
          className={`flex gap-4 md:gap-5 overflow-x-auto hide-scrollbar pt-2 pb-8 ${isTop10 ? 'pr-8 pl-4' : ''} ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        >
          {movies.map((movie, index) => (
            <div key={movie.id} className={`shrink-0 relative flex items-center ${isTop10 ? 'w-[180px] md:w-[230px] lg:w-[260px] pl-10 md:pl-16' : 'w-[140px] md:w-[180px] lg:w-[200px]'}`}>
              
              {/* SỐ TOP KHỔNG LỒ (Bám sát bên trái, đè lên poster) */}
              {isTop10 && (
                <div className="absolute left-0 bottom-8 md:bottom-12 z-10 font-black text-[100px] md:text-[140px] leading-none tracking-tighter pointer-events-none" style={{
                  WebkitTextStroke: "2px rgba(255, 255, 255, 0.7)",
                  color: "transparent",
                  textShadow: "0 0 20px rgba(0,0,0,0.8)",
                  transform: "translateX(-15%)"
                }}>
                  {index + startNumber}
                </div>
              )}

              {/* Thẻ phim */}
              <div className="w-full z-20">
                <MovieCard movie={movie} />
              </div>
            </div>
          ))}
        </div>

        {/* MŨI TÊN PHẢI - TO HƠN, KÍNH MỜ TRẮNG SÁNG */}
        <button 
          onClick={scrollRight}
          className={`absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-14 h-14 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 cursor-pointer hidden md:flex border hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)] ${
            isAtEnd && viewAllState
              ? 'bg-yellow-500/90 text-black border-yellow-400 hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)]'
              : 'bg-black/60 text-white border-white/10 hover:bg-white/20 hover:border-white/40 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]'
          }`}
        >
          <span className="material-symbols-outlined text-3xl">
            {isAtEnd 
              ? (isTop10 ? 'restart_alt' : (viewAllState ? 'arrow_forward' : 'chevron_right')) 
              : 'chevron_right'}
          </span>
        </button>
      </div>
    </section>
  );
}