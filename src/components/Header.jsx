import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import AppDownloadModal from "./AppDownloadModal";
import SearchModal from "./SearchModal";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, userData, getRankInfo } = useAuth();
  
  // Trạng thái đóng/mở menu trên Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Trạng thái popup tải App
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  
  // Trạng thái popup tìm kiếm
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Hàm để kiểm tra xem menu nào đang được chọn
  const isActive = (slug) => location.state?.slug === slug;

  // Hàm đóng menu mobile khi bấm vào link
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Trạng thái cuộn trang
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 w-full h-header-height z-50 transition-all duration-500 ${isScrolled ? 'bg-black/80 backdrop-blur-3xl border-b border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]' : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent border-b border-transparent'}`}>
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
            <h1 className="font-headline-lg text-[18px] md:text-[20px] font-black text-white tracking-tighter hidden lg:block uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] transition-all">
              PHIM HAY QUÁ TRỜI
            </h1>
          </Link>
        </div>

        {/* 2. Ở GIỮA: BỘ LỌC PHIM (Chỉ hiện trên PC/Tablet lớn) */}
        <nav className="hidden md:flex items-center gap-6 bg-white/5 border border-white/10 rounded-full px-6 py-2.5 backdrop-blur-md shadow-lg">
          <Link 
            to="/" 
            className={`text-[13px] uppercase tracking-wider font-bold transition-all duration-300 ${currentPath === "/" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white"}`}
          >
            Trang Chủ
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-chieu-rap', title: 'Phim Chiếu Rạp' }}
            className={`text-[13px] uppercase tracking-wider font-bold transition-all duration-300 ${isActive('phim-chieu-rap') ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white"}`}
          >
            Chiếu Rạp
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-le', title: 'Phim Lẻ' }}
            className={`text-[13px] uppercase tracking-wider font-bold transition-all duration-300 ${isActive('phim-le') ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white"}`}
          >
            Phim Lẻ
          </Link>

          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-bo', title: 'Phim Bộ' }}
            className={`text-[13px] uppercase tracking-wider font-bold transition-all duration-300 ${isActive('phim-bo') ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-400 hover:text-white"}`}
          >
            Phim Bộ
          </Link>
        </nav>

        {/* 3. BÊN PHẢI: ICON TÌM KIẾM, HỒ SƠ & NÚT MENU MOBILE */}
        <div className="flex-1 flex items-center justify-end gap-3 md:gap-4">
          
          {/* NÚT TÌM KIẾM (MỞ MODAL) - Đặt relative để Dropdown bám theo */}
          <div className="relative">
            <button 
              onClick={() => { setIsSearchModalOpen(true); closeMobileMenu(); }}
              className={`p-2.5 rounded-full transition-all duration-300 border flex items-center justify-center border-transparent text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20`}
              title="Tìm kiếm phim nhanh"
            >
              <span className="material-symbols-outlined text-[22px] md:text-[24px]">search</span>
            </button>

            {/* SEARCH MODAL (Bây giờ là Dropdown tuyệt đối) */}
            <SearchModal 
              isOpen={isSearchModalOpen} 
              onClose={() => setIsSearchModalOpen(false)} 
            />
          </div>

          {/* NÚT KHO PHIM (DẪN TỚI /SEARCH) */}
          <Link 
            to="/search" 
            onClick={closeMobileMenu}
            className={`p-2.5 rounded-full transition-all duration-300 border flex items-center justify-center ${currentPath === "/search" && !location.state ? "bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-md" : "border-transparent text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20"}`}
            title="Kho Phim / Lọc Phim"
          >
            <span className="material-symbols-outlined text-[22px] md:text-[24px]">grid_view</span>
          </Link>

          {user ? (() => {
            const rank = getRankInfo(userData?.totalWatchSeconds || 0);
            return (
              <Link 
                to="/profile" 
                onClick={closeMobileMenu}
                className={`relative rounded-full transition-all duration-300 border-2 flex items-center justify-center ${rank.border} ${rank.glow} hover:scale-110`}
                title={`${rank.name} (${Math.floor((userData?.totalWatchSeconds || 0)/3600)} giờ xem)`}
              >
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover" />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] md:text-[12px] ${rank.color}`} title={rank.name}>
                  {rank.icon}
                </div>
              </Link>
            );
          })() : (
            <Link 
              to="/profile" 
              onClick={closeMobileMenu}
              className={`p-2.5 rounded-full transition-all duration-300 border flex items-center justify-center ${currentPath === "/profile" ? "bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-md" : "border-transparent text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20"}`}
            >
              <span className="material-symbols-outlined text-[22px] md:text-[24px]">person</span>
            </Link>
          )}

          {/* NÚT MỞ POPUP DOWNLOAD APP */}
          <button 
            onClick={() => setIsDownloadModalOpen(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#e50914] to-[#b20710] text-white font-semibold text-sm transition-transform hover:scale-105 shadow-[0_0_15px_rgba(229,9,20,0.5)]"
          >
            <span className="material-symbols-outlined text-[20px]">smartphone</span>
            Tải App
          </button>

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

          <button 
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsDownloadModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 text-[16px] font-bold py-3 px-4 rounded-xl mt-2 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white transition-all shadow-[0_0_10px_rgba(229,9,20,0.3)]"
          >
            <span className="material-symbols-outlined text-[20px]">smartphone</span>
            Tải App Phim Hay Quá Trời
          </button>
        </nav>
      )}

      {/* DOWNLOAD APP MODAL */}
      <AppDownloadModal 
        isOpen={isDownloadModalOpen} 
        onClose={() => setIsDownloadModalOpen(false)} 
      />
    </header>
  );
}