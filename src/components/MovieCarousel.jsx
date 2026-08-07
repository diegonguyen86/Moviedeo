import { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import MovieCard from "./MovieCard";

export default function MovieCarousel({ title, movies, viewAllState, isTop10 = false, startNumber = 1 }) {
  const rowRef = useRef(null);
  const navigate = useNavigate();
  const [isAtEnd, setIsAtEnd] = useState(false);

  // Drag to scroll states
  const [isDragging, setIsDragging] = useState(false);
  
  // Use refs for values that change rapidly during drag to avoid re-renders
  const startX = useRef(0);
  const scrollLeftState = useRef(0);
  const dragDistance = useRef(0);

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
    startX.current = e.pageX - rowRef.current.offsetLeft;
    scrollLeftState.current = rowRef.current.scrollLeft;
    dragDistance.current = 0;
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
    const walk = (x - startX.current) * 1.5; // Tốc độ cuộn (nhân 1.5 để mượt hơn)
    dragDistance.current = Math.abs(walk);
    rowRef.current.scrollLeft = scrollLeftState.current - walk;
  };

  const handleClickCapture = (e) => {
    if (dragDistance.current > 5) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <section className="mt-12 px-6 max-w-container-max mx-auto w-full relative group/carousel">
      
      <div className="flex items-end justify-between mb-4">
        {/* TIÊU ĐỀ NỔI BẬT HƠN (Gradient Chữ Neon Vàng/Cam) */}
        <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
          {title}
        </h3>
        
        {/* NÚT XEM TẤT CẢ TINH TẾ */}
        {viewAllState && (
          <Link 
            to="/search"
            state={viewAllState}
            className="text-zinc-500 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:text-yellow-400 transition-colors flex items-center gap-1 group"
          >
            Xem tất cả
            <span className="material-symbols-outlined text-[14px] bg-white/5 rounded-full p-1 group-hover:bg-yellow-500 group-hover:text-black transition-all">
              arrow_forward
            </span>
          </Link>
        )}
      </div>
      
      <div className="relative">
        {/* MŨI TÊN TRÁI */}
        <button 
          onClick={scrollLeft}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-yellow-500 hover:text-black hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-white/5 cursor-pointer hidden md:flex"
        >
          <span className="material-symbols-outlined text-2xl">chevron_left</span>
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
          className={`flex gap-2 md:gap-3 overflow-x-auto hide-scrollbar pt-2 pb-6 ${isTop10 ? 'pr-8 pl-4' : ''} ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}
        >
          {movies.map((movie, index) => (
            <div 
              key={movie.id} 
              className={`shrink-0 relative flex items-center ${isTop10 ? 'w-[160px] md:w-[200px] lg:w-[240px] pl-8 md:pl-12' : 'w-[130px] md:w-[160px] lg:w-[190px]'}`}
              style={{ transform: 'translateZ(0)', willChange: 'transform' }}
            >
              
              {/* SỐ TOP KHỔNG LỒ (Gradient Vàng Cam) */}
              {isTop10 && (
                <div className="absolute left-[-5%] bottom-10 z-10 font-black text-[90px] md:text-[130px] leading-none tracking-tighter pointer-events-none text-transparent bg-clip-text bg-gradient-to-b from-orange-500 via-yellow-500 to-transparent" style={{
                  textShadow: "0 10px 30px rgba(0,0,0,0.9)",
                  transform: "translateZ(0)",
                  willChange: "transform"
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
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-30 w-14 h-14 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 cursor-pointer hidden md:flex border hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)] ${
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