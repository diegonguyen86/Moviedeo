import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MovieCard from "../components/MovieCard";
import {
  apiGetPhimTheoDanhSach,
  apiGetPhimTheoTheLoai,
  apiGetPhimTheoQuocGia,
  apiGetPhimTheoNam,
  apiSearchPhim,
  apiGetPhimMoiCapNhat,
  formatMovieItem
} from "../api/api";

// --- CÁC HẰNG SỐ DỮ LIỆU ---
const types = [
  { name: "Phim Mới Cập Nhật", slug: "phim-moi", type: 'phim-moi' },
  { name: "Phim Đang Chiếu", slug: "phim-dang-chieu", type: 'danh-sach' },
  { name: "Phim Lẻ", slug: "phim-le", type: 'danh-sach' },
  { name: "Phim Bộ", slug: "phim-bo", type: 'danh-sach' }
];

const categories = [
  { name: "Hành Động", slug: "hanh-dong", type: 'the-loai' },
  { name: "Hài", slug: "hai", type: 'the-loai' },
  { name: "Chính Kịch", slug: "chinh-kich", type: 'the-loai' },
  { name: "Lịch sử", slug: "lich-su", type: 'the-loai' },
  { name: "Bí Ẩn", slug: "bi-an", type: 'the-loai' },
  { name: "Phiêu Lưu", slug: "phieu-luu", type: 'the-loai' },
  { name: "Hình sự", slug: "hinh-su", type: 'the-loai' },
  { name: "Gia đình", slug: "gia-dinh", type: 'the-loai' },
  { name: "Kinh dị", slug: "kinh-di", type: 'the-loai' },
  { name: "Lãng Mạn", slug: "lang-man", type: 'the-loai' },
  { name: "Hoạt Hình", slug: "hoat-hinh", type: 'the-loai' },
  { name: "Tài liệu", slug: "tai-lieu", type: 'the-loai' },
  { name: "Giả Tưởng", slug: "gia-tuong", type: 'the-loai' },
  { name: "Nhạc", slug: "nhac", type: 'the-loai' },
  { name: "Khoa học Viễn tưởng", slug: "khoa-hoc-vien-tuong", type: 'the-loai' },
  { name: "Gây Cấn", slug: "gay-can", type: 'the-loai' },
  { name: "Chiến Tranh", slug: "chien-tranh", type: 'the-loai' },
  { name: "Tâm lý", slug: "tam-ly", type: 'the-loai' },
  { name: "Tình Cảm", slug: "tinh-cam", type: 'the-loai' },
  { name: "Cổ trang", slug: "co-trang", type: 'the-loai' },
  { name: "Miền tây", slug: "mien-tay", type: 'the-loai' },
  { name: "Phim 18+", slug: "phim-18", type: 'the-loai' }
];

const countries = [
  { name: "Âu Mỹ", slug: "au-my", type: 'quoc-gia' },
  { name: "Anh", slug: "anh", type: 'quoc-gia' },
  { name: "Trung Quốc", slug: "trung-quoc", type: 'quoc-gia' },
  { name: "Indonesia", slug: "indonesia", type: 'quoc-gia' },
  { name: "Việt Nam", slug: "viet-nam", type: 'quoc-gia' },
  { name: "Pháp", slug: "phap", type: 'quoc-gia' },
  { name: "Hồng Kông", slug: "hong-kong", type: 'quoc-gia' },
  { name: "Hàn Quốc", slug: "han-quoc", type: 'quoc-gia' },
  { name: "Nhật Bản", slug: "nhat-ban", type: 'quoc-gia' },
  { name: "Thái Lan", slug: "thai-lan", type: 'quoc-gia' },
  { name: "Đài Loan", slug: "dai-loan", type: 'quoc-gia' },
  { name: "Nga", slug: "nga", type: 'quoc-gia' },
  { name: "Hà Lan", slug: "ha-lan", type: 'quoc-gia' },
  { name: "Philippines", slug: "philippines", type: 'quoc-gia' },
  { name: "Ấn Độ", slug: "an-do", type: 'quoc-gia' }
];

const years = Array.from({ length: 2026 - 2004 + 1 }, (_, i) => {
  const year = 2026 - i;
  return { name: `Năm ${year}`, slug: year.toString(), type: 'nam' };
});

export default function BrowsePage() {
  const location = useLocation();
  const navigate = useNavigate();

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
  
  const savedKeyword = sessionStorage.getItem("savedSearch") || "";
  const [searchQuery, setSearchQuery] = useState(savedKeyword);
  const [debouncedQuery, setDebouncedQuery] = useState(savedKeyword);
  
  const [advancedFilters, setAdvancedFilters] = useState([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  useEffect(() => {
    if (location.state) {
      setActiveFilter({
        name: location.state.title,
        slug: location.state.slug,
        type: location.state.type
      });
      setSearchQuery("");
      sessionStorage.removeItem("savedSearch");
    }
  }, [location.state]); 

  const toggleAdvancedFilterItem = (item) => {
    setAdvancedFilters(prev =>
      prev.some(f => f.slug === item.slug)
        ? prev.filter(f => f.slug !== item.slug)
        : [...prev, item]
    );
  };

  const applyAdvancedSearch = () => {
    if (advancedFilters.length > 0) {
      const keyword = advancedFilters.map(f => f.name).join(" ");
      setSearchQuery(keyword);
      if (window.innerWidth < 768) {
        setIsAdvancedOpen(false);
        setIsMobileFilterOpen(false); 
      }
    }
  };

  useEffect(() => {
    sessionStorage.setItem("savedSearch", searchQuery);
    const timer = setTimeout(() => { setDebouncedQuery(searchQuery); }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { setPage(1); }, [debouncedQuery, activeFilter]);

  useEffect(() => {
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

        let res;
        // Gọi API tương ứng với page hiện tại (không cần nhân đôi trang nữa)
        if (debouncedQuery.trim().length > 0) {
          res = await apiSearchPhim(debouncedQuery, page);
        } else {
          res = await fetchFilterPage(page);
        }

        // Tương thích cấu trúc JSON của KKPhim
        const items = res?.data?.items || res?.items || [];
        const apiTotalPages = res?.data?.params?.pagination?.totalPages || res?.pagination?.totalPages || 1;

        setMovies(items.map(formatMovieItem));
        setTotalPages(apiTotalPages);

      } catch (error) {
        console.error("Lỗi fetch phim:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeFilter, page, debouncedQuery]);

  const handleFilterClick = (filter) => {
    if (activeFilter?.slug === filter.slug) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
    }
    setSearchQuery("");
    if (window.innerWidth < 768) {
      setIsMobileFilterOpen(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const getPaginationGroup = () => {
    let start = Math.floor((page - 1) / 5) * 5;
    return new Array(5).fill().map((_, idx) => start + idx + 1).filter(p => p <= totalPages);
  };

  const FilterSection = ({ title, items }) => {
    const isActiveGroup = items.some(item => item.slug === activeFilter?.slug);
    const [isOpen, setIsOpen] = useState(isActiveGroup);
    useEffect(() => { if (isActiveGroup) setIsOpen(true); }, [isActiveGroup]);

    return (
      <div className="mb-4 bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-300 text-white">
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3.5 bg-zinc-900/40 hover:bg-zinc-800 transition-colors">
          <span className="font-semibold text-[15px]">{title}</span>
          <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>expand_more</span>
        </button>
        {isOpen && (
          <div className="p-4 border-t border-zinc-800/30 flex flex-wrap gap-2 bg-zinc-900/10">
            {items.map((item) => (
              <button key={item.slug} onClick={() => handleFilterClick(item)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${activeFilter?.slug === item.slug
                  ? "bg-primary text-white border-primary"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-primary/50"}`}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const AdvancedFilterSection = () => (
    <div className="mb-6 bg-primary/10 border border-primary/30 rounded-xl overflow-hidden">
      <button onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="w-full flex items-center justify-between p-3.5 bg-primary/20 hover:bg-primary/30 text-primary">
        <span className="font-bold text-[15px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">tune</span> Lọc Nâng Cao
        </span>
        <span className={`material-symbols-outlined transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`}>expand_more</span>
      </button>
      {isAdvancedOpen && (
        <div className="p-4 border-t border-primary/20 flex flex-col gap-4">
          {[ {t: "Thể Loại", d: categories}, {t: "Quốc Gia", d: countries}, {t: "Năm", d: years} ].map(sec => (
            <div key={sec.t} className="flex flex-col gap-2">
              <span className="text-xs font-bold text-zinc-500 uppercase">{sec.t}</span>
              <div className="flex flex-wrap gap-1.5">
                {sec.d.map(item => {
                  const isSelected = advancedFilters.some(f => f.slug === item.slug);
                  return (
                    <button key={`adv-${item.slug}`} onClick={() => toggleAdvancedFilterItem(item)}
                      className={`px-2 py-1 rounded-md text-xs font-medium border ${isSelected ? "bg-primary text-white border-primary shadow-sm" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
                    > {item.name} </button>
                  )
                })}
              </div>
            </div>
          ))}
          <button onClick={applyAdvancedSearch} disabled={advancedFilters.length === 0} className="w-full mt-2 py-2 rounded-lg font-bold bg-primary text-white hover:bg-primary-fixed disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase">
            <span className="material-symbols-outlined text-[18px]">search</span> Bắt đầu lọc phim
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="pt-24 min-h-screen px-6 max-w-container-max mx-auto pb-20 bg-black">
      {/* Search Bar */}
      <div className="relative mb-6 w-full md:w-2/3 lg:w-1/2 mx-auto">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-2xl">search</span>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm kiếm phim, diễn viên, đạo diễn..."
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-primary text-white rounded-full pl-12 pr-12 py-4 outline-none transition-all" />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* NÚT TẮT/MỞ BỘ LỌC TRÊN MOBILE */}
        <div className="md:hidden w-full">
          <button 
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-primary font-bold hover:bg-zinc-800 transition-colors"
          >
            <span className="material-symbols-outlined">
              {isMobileFilterOpen ? "close" : "filter_alt"}
            </span>
            {isMobileFilterOpen ? "Đóng Bộ Lọc" : "Mở Bộ Lọc Phim"}
          </button>
        </div>

        {/* Sidebar Bộ Lọc */}
        <aside className={`w-full md:w-1/4 lg:w-1/5 shrink-0 h-fit bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 backdrop-blur-md md:sticky md:top-24 ${isMobileFilterOpen ? "block" : "hidden md:block"}`}>
          <div className="flex items-center gap-2 mb-6 text-primary font-bold hidden md:flex">
            <span className="material-symbols-outlined">filter_alt</span>
            <span className="text-xl">Bộ Lọc Phim</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
            <AdvancedFilterSection />
            <div className="h-[1px] w-full bg-zinc-800 mb-6 hidden md:block"></div>
            <FilterSection title="Định Đạng" items={types} />
            <FilterSection title="Thể Loại" items={categories} />
            <FilterSection title="Quốc Gia" items={countries} />
            <FilterSection title="Năm Phát Hành" items={years} />
          </div>
        </aside>

        {/* Movie Grid */}
        <section className="flex-1 flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
              {debouncedQuery.trim().length > 0
                ? `Kết quả cho: "${debouncedQuery}"`
                : activeFilter ? activeFilter.name : `TẤT CẢ PHIM`}
            </h2>
            <span className="text-sm text-zinc-500 font-bold">Trang {page} / {totalPages}</span>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-32">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="mt-4 text-zinc-500 font-medium italic animate-pulse">Đang lục kho phim...</div>
            </div>
          ) : movies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 mb-10">
                {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-1 md:gap-2 mt-auto pt-8 border-t border-zinc-800 flex-wrap">
                  <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-white hover:bg-primary disabled:opacity-30 transition-colors flex items-center justify-center">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  {getPaginationGroup().map((p) => (
                    <button key={p} onClick={() => handlePageChange(p)} className={`w-10 h-10 rounded-full font-bold transition-all ${page === p ? "bg-primary text-white scale-110 shadow-lg" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 text-white hover:bg-primary disabled:opacity-30 transition-colors flex items-center justify-center">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-32 bg-zinc-900/30 rounded-xl border border-zinc-800">
              <span className="material-symbols-outlined text-5xl mb-4 text-zinc-700">movie_off</span>
              <p className="text-zinc-500 font-medium text-center px-4">Kho phim hiện chưa có phim này, bạn quay lại sau nhé!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}