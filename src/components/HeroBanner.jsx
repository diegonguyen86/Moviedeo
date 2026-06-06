import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiGetTrailer } from "../api/api";

export default function HeroBanner({ movie }) {
  const [trailerKey, setTrailerKey] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    if (!movie) return;
    const fetchTrailer = async () => {
      const key = await apiGetTrailer(movie.origin_name || movie.title);
      if (key) {
        setTrailerKey(key);
        // Delay slighty before showing video to ensure smooth transition
        setTimeout(() => setIsVideoPlaying(true), 2000);
      } else {
        setTrailerKey(null);
        setIsVideoPlaying(false);
      }
    };
    fetchTrailer();
  }, [movie]);

  if (!movie) return null;

  return (
    <section className="relative w-full h-[50vh] md:h-[65vh] flex items-end overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          alt={movie.title}
          className={`w-full h-full object-cover object-top transition-opacity duration-1000 ${isVideoPlaying ? 'opacity-0' : 'opacity-100'}`}
          src={movie.image}
        />
        
        {/* VIDEO NỀN TỰ ĐỘNG PHÁT */}
        {trailerKey && (
          <div className={`absolute top-1/2 left-1/2 w-[150vw] h-[150vh] md:w-[120vw] md:h-[150vh] -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-1000 ${isVideoPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&modestbranding=1&playsinline=1`}
              title="Trailer Background"
              className="w-full h-full object-cover"
              allow="autoplay; encrypted-media"
              frameBorder="0"
            ></iframe>
          </div>
        )}
        
        {/* Lớp phủ Gradient tạo chiều sâu điện ảnh */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
      </div>
      
      <div className="relative z-10 px-6 md:px-12 pb-12 md:pb-16 w-full max-w-container-max mx-auto">
        <div className="space-y-6 max-w-2xl">
          
          <div className="flex items-center gap-2">
            {/* 👇 FIX: Chuyển Badge Trending sang Kính mờ Trắng, bỏ màu Tím */}
            <span className="bg-white/10 text-white px-4 py-1.5 rounded-md font-black text-xs border border-white/30 uppercase tracking-widest backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              ✨ Trending Now
            </span>
          </div>
          
          <h2 className="text-3xl md:text-5xl leading-tight font-black text-white uppercase tracking-tighter drop-shadow-2xl">
            {movie.title}
          </h2>
          
          <p className="text-zinc-300 font-medium text-sm md:text-base line-clamp-3 leading-relaxed drop-shadow-md max-w-xl">
            {movie.description || "Một siêu phẩm điện ảnh đang làm mưa làm gió trên các bảng xếp hạng. Khám phá ngay!"}
          </p>
          
          <div className="flex items-center gap-4 pt-4">
            {/* NÚT PHÁT NGAY - TÔNG TRẮNG ĐEN GLOW QUYỀN LỰC */}
            <Link to={`/movie/${movie.id}`} className="group flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-black text-xs hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-95">
              <span className="material-symbols-outlined filled text-[24px] group-hover:animate-pulse">play_circle</span>
              PHÁT NGAY
            </Link>
            
            {/* NÚT CHI TIẾT - KÍNH MỜ TRẮNG VIỀN SÁNG */}
            <Link to={`/movie/${movie.id}`} className="group flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-full font-bold text-xs border border-white/20 hover:bg-white/20 hover:border-white/50 transition-all duration-300 active:scale-95 backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <span className="material-symbols-outlined text-[24px] group-hover:rotate-12 transition-transform drop-shadow-md">info</span>
              CHI TIẾT
            </Link>
          </div>
          
        </div>
      </div>
    </section>
  );
}