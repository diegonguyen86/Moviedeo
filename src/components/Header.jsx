import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Hàm để kiểm tra xem menu nào đang được chọn dựa trên dữ liệu gửi đi (state)
  const isActive = (slug) => location.state?.slug === slug;

  return (
    <header className="fixed top-0 w-full h-header-height z-50 backdrop-blur-xl border-b border-border-glass bg-navbar-bg">
      <div className="flex items-center justify-between px-6 h-full max-w-container-max mx-auto">
        
        {/* 1. BÊN TRÁI: LOGO & TÊN WEB */}
        <div className="flex-1 flex items-center">
          <Link to="/" className="flex items-center gap-4 group">
            <img 
              src={`${import.meta.env.BASE_URL}icon.png`} 
              alt="Logo" 
              className="w-8 h-8 group-hover:scale-110 transition-transform object-contain" 
            />
            <h1 className="font-headline-lg text-[20px] font-bold text-primary tracking-tighter hidden lg:block uppercase text-white">
              PHIM HAY QUÁ TRỜI
            </h1>
          </Link>
        </div>

        {/* 2. Ở GIỮA: BỘ LỌC PHIM (Đã đổi Trending thành Mới Cập Nhật) */}
        <nav className="hidden md:flex items-center gap-10">
          <Link 
            to="/" 
            className={`text-[15px] font-bold transition-all hover:text-primary ${currentPath === "/" ? "text-primary border-b-2 border-primary" : "text-text-secondary"}`}
          >
            Trang Chủ
          </Link>

          {/* Mục Mới Cập Nhật - Thay thế cho Trending */}
          <Link 
            to="/search" 
            state={{ type: 'phim-moi', slug: 'phim-moi', title: 'Phim Mới Cập Nhật' }}
            className={`text-[15px] font-bold transition-all hover:text-primary ${isActive('phim-moi') ? "text-primary border-b-2 border-primary" : "text-text-secondary"}`}
          >
            Mới Cập Nhật
          </Link>

          {/* Mục Phim Lẻ */}
          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-le', title: 'Phim Lẻ' }}
            className={`text-[15px] font-bold transition-all hover:text-primary ${isActive('phim-le') ? "text-primary border-b-2 border-primary" : "text-text-secondary"}`}
          >
            Phim Lẻ
          </Link>

          {/* Mục Phim Bộ */}
          <Link 
            to="/search" 
            state={{ type: 'danh-sach', slug: 'phim-bo', title: 'Phim Bộ' }}
            className={`text-[15px] font-bold transition-all hover:text-primary ${isActive('phim-bo') ? "text-primary border-b-2 border-primary" : "text-text-secondary"}`}
          >
            Phim Bộ
          </Link>
        </nav>

        {/* 3. BÊN PHẢI: ICON TÌM KIẾM & HỒ SƠ */}
        <div className="flex-1 flex items-center justify-end gap-3">
          <Link 
            to="/search" 
            className={`p-2 rounded-full transition-all duration-300 hover:bg-hover-glow ${currentPath === "/search" && !location.state ? "bg-primary/20 text-primary" : "text-text-secondary"}`}
          >
            <span className="material-symbols-outlined text-[26px]">search</span>
          </Link>

          <Link 
            to="/profile" 
            className={`p-2 rounded-full transition-all duration-300 hover:bg-hover-glow ${currentPath === "/profile" ? "bg-primary/20 text-primary" : "text-text-secondary"}`}
          >
            <span className="material-symbols-outlined text-[26px]">person</span>
          </Link>
        </div>

      </div>
    </header>
  );
}