import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import {
  apiGetPhimTheoDanhSach,
  apiGetPhimTheoTheLoai,
  apiGetPhimTheoQuocGia,
  apiGetPhimTheoNam,
  apiGetPhimMoiCapNhat,
  formatMovieItem
} from "../api/api";
import { PosterGridSkeleton } from "../components/Skeletons";

const types = [
  { name: "Phim Chiếu Rạp", slug: "phim-chieu-rap", type: 'danh-sach' },
  { name: "Phim Lẻ", slug: "phim-le", type: 'danh-sach' },
  { name: "Phim Bộ", slug: "phim-bo", type: 'danh-sach' },
  { name: "TV Shows", slug: "tv-shows", type: 'danh-sach' },
  { name: "Hoạt Hình", slug: "hoat-hinh", type: 'danh-sach' }
];

const categories = [
  { name: "Hành Động", slug: "hanh-dong", type: 'the-loai' },
  { name: "Cổ Trang", slug: "co-trang", type: 'the-loai' },
  { name: "Chiến Tranh", slug: "chien-tranh", type: 'the-loai' },
  { name: "Viễn Tưởng", slug: "vien-tuong", type: 'the-loai' },
  { name: "Kinh Dị", slug: "kinh-di", type: 'the-loai' },
  { name: "Tài Liệu", slug: "tai-lieu", type: 'the-loai' },
  { name: "Bí Ẩn", slug: "bi-an", type: 'the-loai' },
  { name: "Phim 18+", slug: "phim-18", type: 'the-loai' },
  { name: "Tình Cảm", slug: "tinh-cam", type: 'the-loai' },
  { name: "Tâm Lý", slug: "tam-ly", type: 'the-loai' },
  { name: "Thể Thao", slug: "the-thao", type: 'the-loai' },
  { name: "Phiêu Lưu", slug: "phieu-luu", type: 'the-loai' },
  { name: "Âm Nhạc", slug: "am-nhac", type: 'the-loai' },
  { name: "Gia Đình", slug: "gia-dinh", type: 'the-loai' },
  { name: "Học Đường", slug: "hoc-duong", type: 'the-loai' },
  { name: "Hài Hước", slug: "hai-huoc", type: 'the-loai' },
  { name: "Hình Sự", slug: "hinh-su", type: 'the-loai' },
  { name: "Võ Thuật", slug: "vo-thuat", type: 'the-loai' },
  { name: "Khoa Học", slug: "khoa-hoc", type: 'the-loai' },
  { name: "Thần Thoại", slug: "than-thoai", type: 'the-loai' },
  { name: "Chính Kịch", slug: "chinh-kich", type: 'the-loai' },
  { name: "Kinh Điển", slug: "kinh-dien", type: 'the-loai' },
  { name: "Phim Ngắn", slug: "phim-ngan", type: 'the-loai' }
];

const countries = [
  { name: "Trung Quốc", slug: "trung-quoc", type: 'quoc-gia' },
  { name: "Hàn Quốc", slug: "han-quoc", type: 'quoc-gia' },
  { name: "Nhật Bản", slug: "nhat-ban", type: 'quoc-gia' },
  { name: "Thái Lan", slug: "thai-lan", type: 'quoc-gia' },
  { name: "Âu Mỹ", slug: "au-my", type: 'quoc-gia' },
  { name: "Đài Loan", slug: "dai-loan", type: 'quoc-gia' },
  { name: "Hồng Kông", slug: "hong-kong", type: 'quoc-gia' },
  { name: "Ấn Độ", slug: "an-do", type: 'quoc-gia' },
  { name: "Anh", slug: "anh", type: 'quoc-gia' },
  { name: "Pháp", slug: "phap", type: 'quoc-gia' },
  { name: "Canada", slug: "canada", type: 'quoc-gia' },
  { name: "Đức", slug: "duc", type: 'quoc-gia' },
  { name: "Tây Ban Nha", slug: "tay-ban-nha", type: 'quoc-gia' },
  { name: "Việt Nam", slug: "viet-nam", type: 'quoc-gia' },
  { name: "Quốc Gia Khác", slug: "quoc-gia-khac", type: 'quoc-gia' }
];

const CURRENT_YEAR = new Date().getFullYear();
const years = Array.from({ length: CURRENT_YEAR - 2000 + 1 }, (_, i) => {
  const year = CURRENT_YEAR - i;
  return { name: `Năm ${year}`, slug: year.toString(), type: 'nam' };
});

const isSameFilter = (a, b) => a?.slug === b?.slug && a?.type === b?.type;

// Bốn nhóm lọc. API chỉ lọc được MỘT tiêu chí mỗi lần, nên mỗi lúc chỉ một chip được chọn.
// Mỗi nhóm lọc một màu phân loại cố định (evon P17), khớp màu hàng phim ở trang chủ
const FILTER_GROUPS = [
  { key: "type", label: "Định dạng", items: types, icon: "movie", tone: "text-cat-1" },
  { key: "genre", label: "Thể loại", items: categories, icon: "theater_comedy", tone: "text-cat-2" },
  { key: "country", label: "Quốc gia", items: countries, icon: "public", tone: "text-cat-3" },
  { key: "year", label: "Năm", items: years, icon: "calendar_month", tone: "text-cat-4" },
];

const groupOfFilter = (filter) =>
  FILTER_GROUPS.find((g) => g.items.some((item) => isSameFilter(item, filter)))?.key || "type";

// Chip lọc (evon small-controls): đang chọn nền sáng chữ tối (vai màu "mục đang chọn" của dự án), còn lại viền mảnh
function FilterChip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${
        active
          ? "bg-fg font-medium text-canvas"
          : "border border-line-strong text-fg-2 hover:bg-white/5 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export default function BrowsePage() {
  const location = useLocation();

  const [activeFilter, setActiveFilter] = useState(() => {
    if (location.state) {
      return {
        name: location.state.title,
        slug: location.state.slug,
        type: location.state.type
      };
    }
    return null;
  });

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Nhóm chip đang mở: theo bộ lọc đang chọn
  const [openGroup, setOpenGroup] = useState(() => groupOfFilter(activeFilter));
  useEffect(() => { if (activeFilter) setOpenGroup(groupOfFilter(activeFilter)); }, [activeFilter]);

  // Bấm menu Header / "Xem tất cả" khi đang ở sẵn trang /search -> đổi bộ lọc theo state mới.
  // Bấm nút "Kho phim" (không có state) -> về "Tất cả phim".
  useEffect(() => {
    const next = location.state
      ? { name: location.state.title, slug: location.state.slug, type: location.state.type }
      : null;
    setActiveFilter(prev => (isSameFilter(prev, next) && !!prev === !!next ? prev : next));
    setPage(1);
    sessionStorage.removeItem("savedSearch");
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let isCurrent = true; // Bỏ qua kết quả trả về muộn khi người dùng đã bấm sang bộ lọc/trang khác
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const fetchFilterPage = async (apiPage) => {
          if (!activeFilter) return await apiGetPhimMoiCapNhat(apiPage);
          
          switch (activeFilter.type) {
            case 'phim-moi': return await apiGetPhimMoiCapNhat(apiPage);
            case 'danh-sach': return await apiGetPhimTheoDanhSach(activeFilter.slug, apiPage);
            case 'the-loai': return await apiGetPhimTheoTheLoai(activeFilter.slug, apiPage);
            case 'quoc-gia': return await apiGetPhimTheoQuocGia(activeFilter.slug, apiPage);
            case 'nam': return await apiGetPhimTheoNam(activeFilter.slug, apiPage);
            default: return await apiGetPhimMoiCapNhat(apiPage);
          }
        };

        const res = await fetchFilterPage(page);
        if (!isCurrent) return;

        const items = res?.data?.items || res?.items || [];
        const apiTotalPages = res?.data?.params?.pagination?.totalPages || res?.pagination?.totalPages || 1;

        // Loại phim trùng slug (API đôi khi trả trùng -> React báo lỗi key)
        const seen = new Set();
        const formatted = items.map(formatMovieItem).filter(m => m.id && !seen.has(m.id) && seen.add(m.id));

        setMovies(formatted);
        setTotalPages(Math.max(1, apiTotalPages));
        setHasLoadedOnce(true);

      } catch (error) {
        // Tải lần hai hỏng thì giữ danh sách cũ (evon loading.md); lần đầu hỏng thì hiện trạng thái rỗng
        if (isCurrent && !hasLoadedOnce) setMovies([]);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchMovies();
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { isCurrent = false; };
  }, [activeFilter, page]);

  const handleFilterClick = (filter) => {
    // Đổi bộ lọc thì về trang 1 luôn (trước đây tải trang cũ của bộ lọc mới rồi mới tải lại trang 1)
    setPage(1);
    if (isSameFilter(activeFilter, filter)) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const getPaginationGroup = () => {
    let start = Math.floor((page - 1) / 5) * 5;
    return new Array(5).fill().map((_, idx) => start + idx + 1).filter(p => p <= totalPages);
  };

  const currentGroup = FILTER_GROUPS.find((g) => g.key === openGroup) || FILTER_GROUPS[0];
  const isFirstLoad = loading && !hasLoadedOnce;
  const isReloading = loading && hasLoadedOnce;

  return (
    <main className="relative mx-auto min-h-screen max-w-container-max px-4 pb-20 pt-24 sm:px-6">
      {/* Vệt loang màu thương hiệu ở đầu trang (Vivid) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72 bg-gradient-to-b from-brand/[0.12] via-accent-to/[0.04] to-transparent" aria-hidden="true" />
      {/* Đầu trang: tên + trang */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{activeFilter ? activeFilter.name : "Tất cả phim"}</h1>
        {hasLoadedOnce && totalPages > 1 && (
          <span className="shrink-0 text-sm text-fg-3">Trang {page}/{totalPages}</span>
        )}
      </div>

      {/* Bộ lọc: chọn nhóm, rồi chọn chip. Hàng chip cuộn ngang ở điện thoại */}
      {/* Chỉ dính đầu trang ở máy tính. Điện thoại màn thấp: dính thì header + thanh lọc chiếm ~1/4 màn, che poster */}
      <div className="-mx-4 mb-6 border-b border-line px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 md:sticky md:top-16 md:z-30 md:bg-canvas/90 md:supports-[backdrop-filter]:bg-canvas/75 md:supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="scrollbar-clean mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Nhóm bộ lọc">
          {FILTER_GROUPS.map((group) => {
            const selected = group.key === openGroup;
            const hasActive = group.items.some((item) => isSameFilter(item, activeFilter));
            return (
              <button
                key={group.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setOpenGroup(group.key)}
                className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors sm:px-3 ${selected ? "bg-white/[0.08] font-medium text-fg" : "text-fg-2 hover:bg-white/5 hover:text-fg"}`}
              >
                <span className={`material-symbols-outlined text-[18px] ${group.tone}`} style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{group.icon}</span>
                {group.label}
                {hasActive && !selected && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" aria-label="đang lọc" />}
              </button>
            );
          })}
          {activeFilter && (
            <button onClick={() => { setPage(1); setActiveFilter(null); }} className="ml-auto flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-fg-2 transition-colors hover:bg-white/5 hover:text-fg">
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span className="hidden sm:inline">Bỏ lọc</span>
            </button>
          )}
        </div>
        <div className="scrollbar-clean -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {currentGroup.items.map((item) => (
            <FilterChip key={`${item.type}-${item.slug}`} active={isSameFilter(item, activeFilter)} onClick={() => handleFilterClick(item)}>
              {currentGroup.key === "year" ? item.slug : item.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Danh sách phim */}
      <section className="relative">
        {/* Tải lần hai: giữ danh sách cũ + thanh mảnh trên đầu */}
        {isReloading && (
          <div className="absolute inset-x-0 -top-3 h-0.5 overflow-hidden rounded-full" aria-hidden="true">
            <div className="h-full w-1/3 animate-progress-slide bg-brand motion-reduce:animate-pulse" />
          </div>
        )}
        {isReloading && <span className="sr-only" role="status">Đang tải kết quả</span>}

        {isFirstLoad ? (
          <PosterGridSkeleton />
        ) : movies.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
            </div>

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-1" aria-label="Phân trang">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="flex size-10 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-white/5 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Trang trước"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {getPaginationGroup().map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    aria-current={page === p ? "page" : undefined}
                    className={`flex size-10 items-center justify-center rounded-lg text-sm tabular-nums transition-colors ${page === p ? "bg-fg font-medium text-canvas" : "text-fg-2 hover:bg-white/5 hover:text-fg"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="flex size-10 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-white/5 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Trang sau"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line px-6 py-20 text-center">
            <span className="material-symbols-outlined mb-3 text-[40px] text-fg-3">movie</span>
            <p className="text-base font-medium text-fg">Chưa có phim nào ở mục này</p>
            <p className="mt-1 text-sm text-fg-2">Thử chọn thể loại hoặc năm khác.</p>
            {activeFilter && (
              <button onClick={() => { setPage(1); setActiveFilter(null); }} className="mt-5 h-10 rounded-lg border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-white/5">
                Xem tất cả phim
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}