import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import AppDownloadModal from "./AppDownloadModal";
import SearchModal from "./SearchModal";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { label: "Trang chủ", to: "/", state: null, match: (path) => path === "/" },
  { label: "Chiếu rạp", to: "/search", state: { type: "danh-sach", slug: "phim-chieu-rap", title: "Phim Chiếu Rạp" } },
  { label: "Phim lẻ", to: "/search", state: { type: "danh-sach", slug: "phim-le", title: "Phim Lẻ" } },
  { label: "Phim bộ", to: "/search", state: { type: "danh-sach", slug: "phim-bo", title: "Phim Bộ" } },
  { label: "Kho phim", to: "/search", state: null, match: (path, state) => path === "/search" && !state },
];

const avatarFallback = (user) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.email?.split("@")[0] || "U")}&background=27272a&color=f4f4f5`;

export default function Header() {
  const location = useLocation();
  const { user, userData, getRankInfo } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Đổi trang thì đóng menu điện thoại
  useEffect(() => { setIsMobileMenuOpen(false); }, [location.key]);

  const isActive = (item) =>
    item.match ? item.match(location.pathname, location.state) : location.pathname === "/search" && location.state?.slug === item.state?.slug;

  const rank = user ? getRankInfo(userData?.totalWatchSeconds || 0) : null;
  const watchHours = Math.floor((userData?.totalWatchSeconds || 0) / 3600);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        isScrolled || isMobileMenuOpen
          ? "border-b border-line bg-canvas/85 supports-[backdrop-filter]:bg-canvas/70 supports-[backdrop-filter]:backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-black/70 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-container-max items-center gap-6 px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" className="size-8 object-contain" />
          <span className="hidden text-base font-semibold tracking-tight text-fg sm:block">Phim Hay Quá Trời</span>
        </Link>

        {/* Điều hướng chính (máy tính) */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                to={item.to}
                state={item.state}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "font-medium text-fg" : "text-fg-2 hover:bg-white/5 hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bên phải */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => { setIsSearchModalOpen(true); setIsMobileMenuOpen(false); }}
              className="flex size-10 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-white/5 hover:text-fg"
              aria-label="Tìm kiếm phim"
              title="Tìm kiếm phim"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
          </div>

          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm font-medium text-fg transition-colors hover:bg-white/5 lg:flex"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Tải app
          </button>

          {user && (
            // Avatar có viền theo màu hạng + huy hiệu hạng ở góc (hạng tính theo giờ xem, xem trang Hồ sơ)
            <Link
              to="/profile"
              className="group/avatar relative ml-1 flex items-center gap-2 rounded-full"
              title={`${rank.name} · ${watchHours} giờ xem`}
              aria-label={`Hồ sơ của bạn · hạng ${rank.name}`}
            >
              <span className={`block rounded-full border-2 p-0.5 transition-transform group-hover/avatar:scale-105 ${rank.border}`}>
                <img
                  src={user.photoURL || avatarFallback(user)}
                  onError={(e) => { e.currentTarget.src = avatarFallback(user); }}
                  alt=""
                  className="size-8 rounded-full object-cover"
                />
              </span>
              <span
                className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full bg-raised text-[11px] leading-none ring-2 ring-canvas"
                aria-hidden="true"
              >
                {rank.icon}
              </span>
            </Link>
          )}

          {/* Nút menu (điện thoại) */}
          <button
            className="flex size-10 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-white/5 hover:text-fg md:hidden"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-symbols-outlined text-[24px]">{isMobileMenuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Menu điện thoại */}
      {isMobileMenuOpen && (
        <nav className="border-t border-line px-4 pb-4 pt-2 md:hidden" aria-label="Điều hướng chính">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  state={item.state}
                  className={`flex h-11 items-center rounded-lg px-3 text-[15px] transition-colors ${
                    active ? "bg-white/[0.08] font-medium text-fg" : "text-fg-2 hover:bg-white/5 hover:text-fg"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <button
            onClick={() => { setIsMobileMenuOpen(false); setIsDownloadModalOpen(true); }}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-sm font-medium text-fg"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Tải app Phim Hay Quá Trời
          </button>
        </nav>
      )}

      <AppDownloadModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />
    </header>
  );
}
