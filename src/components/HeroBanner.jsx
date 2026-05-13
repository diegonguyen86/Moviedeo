import { Link } from "react-router-dom";

export default function HeroBanner({ movie }) {
  if (!movie) return null;

  return (
    <section className="relative w-full h-[60vh] md:h-[80vh] flex items-end overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          alt={movie.title}
          className="w-full h-full object-cover scale-105"
          src={movie.image}
        />
        {/* Lớp phủ Gradient tạo chiều sâu điện ảnh */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
      </div>
      
      <div className="relative z-10 px-6 md:px-12 pb-16 md:pb-24 w-full max-w-container-max mx-auto">
        <div className="space-y-6 max-w-2xl">
          
          <div className="flex items-center gap-2">
            {/* 👇 FIX: Chuyển Badge Trending sang Kính mờ Trắng, bỏ màu Tím */}
            <span className="bg-white/10 text-white px-4 py-1.5 rounded-md font-black text-xs border border-white/30 uppercase tracking-widest backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              ✨ Trending Now
            </span>
          </div>
          
          <h2 className="text-4xl md:text-6xl leading-tight font-black text-white uppercase tracking-tighter drop-shadow-2xl">
            {movie.title}
          </h2>
          
          <p className="text-zinc-300 font-medium text-sm md:text-base line-clamp-3 leading-relaxed drop-shadow-md max-w-xl">
            {movie.description || "Một siêu phẩm điện ảnh đang làm mưa làm gió trên các bảng xếp hạng. Khám phá ngay!"}
          </p>
          
          <div className="flex items-center gap-4 pt-4">
            {/* NÚT PHÁT NGAY - TÔNG TRẮNG ĐEN GLOW QUYỀN LỰC */}
            <Link to={`/movie/${movie.id}`} className="group flex items-center gap-2 bg-white text-black px-8 py-3.5 rounded-full font-black text-sm hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.4)] active:scale-95">
              <span className="material-symbols-outlined filled text-[24px] group-hover:animate-pulse">play_circle</span>
              PHÁT NGAY
            </Link>
            
            {/* NÚT CHI TIẾT - KÍNH MỜ TRẮNG VIỀN SÁNG */}
            <Link to={`/movie/${movie.id}`} className="group flex items-center gap-2 bg-white/10 text-white px-8 py-3.5 rounded-full font-bold text-sm border border-white/20 hover:bg-white/20 hover:border-white/50 transition-all duration-300 active:scale-95 backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <span className="material-symbols-outlined text-[24px] group-hover:rotate-12 transition-transform drop-shadow-md">info</span>
              CHI TIẾT
            </Link>
          </div>
          
        </div>
      </div>
    </section>
  );
}