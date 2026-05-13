import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Trạng thái đóng/mở menu trên Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hàm để kiểm tra xem menu nào đang được chọn
  const isActive = (slug) => location.state?.slug === slug;

  // Hàm đóng menu mobile khi bấm vào link
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="fixed top-0 w-full h-header-height z-50 bg-black/40 backdrop-blur-2xl border-b border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300">
      <div className="flex items-center justify-between px-6 h-full max-w-container-max mx-auto">
        
        {/* 1. BÊN TRÁI: LOGO & TÊN WEB */}
        <div className="flex-1 flex items-center">
          <Link to="/" className="flex items-center gap-4 group" onClick={closeMobileMenu}>
            <img 
              src={`${import.meta.env.BASE_URL}icon.png`} 
              alt="Logo" 
              className="w-8 h-8 group-hover:scale-110 transition-transform object-contain group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" 
            />
            {/* Tên web phát sáng trắng */}
            <h1 className="font-headline-lg text-[20px] font-black text-white tracking-tighter hidden lg:block uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] transition-all">
              PHIM HAY QUÁ TRỜI
            </h1>
          </Link>
        </div>

        {/* 2. Ở GIỮA: BỘ LỌC PHIM (Chỉ hiện trên PC/Tablet lớn) */}
        <nav className="hidden md:flex items-center gap-10">
          <Link 
            to="/" 
            className={`text-[15px] font-bold transition-all duration-300 pb-1 ${currentPath === "/" ? "text-white border-b-2 border-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"}`}
          >
            Trang Chủ
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-chieu-rap', title: 'Phim Chiếu Rạp' }}
            className={`text-[15px] font-bold transition-all duration-300 pb-1 ${isActive('phim-chieu-rap') ? "text-white border-b-2 border-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"}`}
          >
            Phim Chiếu Rạp
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-le', title: 'Phim Lẻ' }}
            className={`text-[15px] font-bold transition-all duration-300 pb-1 ${isActive('phim-le') ? "text-white border-b-2 border-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"}`}
          >
            Phim Lẻ
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-bo', title: 'Phim Bộ' }}
            className={`text-[15px] font-bold transition-all duration-300 pb-1 ${isActive('phim-bo') ? "text-white border-b-2 border-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"}`}
          >
            Phim Bộ
          </Link>
        </nav>

        {/* 3. BÊN PHẢI: ICON TÌM KIẾM, HỒ SƠ & NÚT MENU MOBILE */}
        <div className="flex-1 flex items-center justify-end gap-3 md:gap-4">
          <Link 
            to="/search" 
            onClick={closeMobileMenu}
            className={`p-2.5 rounded-full transition-all duration-300 border flex items-center justify-center ${currentPath === "/search" && !location.state ? "bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-md" : "border-transparent text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20"}`}
          >
            <span className="material-symbols-outlined text-[24px] md:text-[26px]">search</span>
          </Link>

          <Link 
            to="/profile" 
            onClick={closeMobileMenu}
            className={`p-2.5 rounded-full transition-all duration-300 border flex items-center justify-center ${currentPath === "/profile" ? "bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-md" : "border-transparent text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20"}`}
          >
            <span className="material-symbols-outlined text-[24px] md:text-[26px]">person</span>
          </Link>

          {/* NÚT 3 GẠCH (Chỉ hiện trên Mobile) */}
          <button 
            className="md:hidden p-2 rounded-full text-zinc-400 hover:text-white transition-all hover:bg-white/10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined text-[28px] drop-shadow-md">
              {isMobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* 4. MENU XỔ XUỐNG DÀNH CHO MOBILE */}
      {isMobileMenuOpen && (
        <nav className="md:hidden absolute top-full left-0 w-full bg-black/90 backdrop-blur-3xl border-b border-white/10 flex flex-col px-6 py-6 gap-2 shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all">
          <Link 
            to="/" 
            onClick={closeMobileMenu}
            className={`text-[16px] font-bold py-3 px-4 rounded-xl transition-all ${currentPath === "/" ? "text-white bg-white/10 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
          >
            Trang Chủ
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-chieu-rap', title: 'Phim Chiếu Rạp' }}
            onClick={closeMobileMenu}
            className={`text-[16px] font-bold py-3 px-4 rounded-xl transition-all ${isActive('phim-chieu-rap') ? "text-white bg-white/10 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
          >
            Phim Chiếu Rạp
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-le', title: 'Phim Lẻ' }}
            onClick={closeMobileMenu}
            className={`text-[16px] font-bold py-3 px-4 rounded-xl transition-all ${isActive('phim-le') ? "text-white bg-white/10 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
          >
            Phim Lẻ
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-bo', title: 'Phim Bộ' }}
            onClick={closeMobileMenu}
            className={`text-[16px] font-bold py-3 px-4 rounded-xl transition-all ${isActive('phim-bo') ? "text-white bg-white/10 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
          >
            Phim Bộ
          </Link>
        </nav>
      )}
    </header>
  );
}