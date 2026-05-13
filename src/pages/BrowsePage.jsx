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

const years = Array.from({ length: 2026 - 2000 + 1 }, (_, i) => {
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
        if (debouncedQuery.trim().length > 0) {
          res = await apiSearchPhim(debouncedQuery, page);
        } else {
          res = await fetchFilterPage(page);
        }

        const items = res?.data?.items || res?.items || [];
        const apiTotalPages = res?.data?.params?.pagination?.totalPages || res?.pagination?.totalPages || 1;

        setMovies(items.map(formatMovieItem));
        setTotalPages(apiTotalPages);

      } catch (error) {
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

  // 👇 ĐÃ FIX: Chuyển màu Thẻ Lọc sang Trắng/Kính Mờ
  const FilterSection = ({ title, items }) => {
    const isActiveGroup = items.some(item => item.slug === activeFilter?.slug);
    const [isOpen, setIsOpen] = useState(isActiveGroup);
    useEffect(() => { if (isActiveGroup) setIsOpen(true); }, [isActiveGroup]);

    return (
      <div className="mb-4 bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 text-white backdrop-blur-md">
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="font-bold text-[15px]">{title}</span>
          <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>expand_more</span>
        </button>
        {isOpen && (
          <div className="p-4 border-t border-white/5 flex flex-wrap gap-2">
            {items.map((item) => (
              <button key={item.slug} onClick={() => handleFilterClick(item)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeFilter?.slug === item.slug
                  ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                  : "bg-transparent border-white/20 text-zinc-400 hover:border-white/50 hover:text-white"}`}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 👇 ĐÃ FIX: Chuyển Lọc Nâng Cao sang Trắng/Kính Mờ
  const AdvancedFilterSection = () => (
    <div className="mb-6 bg-white/5 border border-white/20 rounded-xl overflow-hidden backdrop-blur-md">
      <button onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="w-full flex items-center justify-between p-3.5 bg-white/10 hover:bg-white/20 text-white transition-colors">
        <span className="font-bold text-[15px] flex items-center gap-2 drop-shadow-md">
          <span className="material-symbols-outlined text-[18px]">tune</span> Lọc Nâng Cao
        </span>
        <span className={`material-symbols-outlined transition-transform ${isAdvancedOpen ? "rotate-180" : ""}`}>expand_more</span>
      </button>
      {isAdvancedOpen && (
        <div className="p-4 border-t border-white/10 flex flex-col gap-5">
          {[ {t: "Thể Loại", d: categories}, {t: "Quốc Gia", d: countries}, {t: "Năm", d: years} ].map(sec => (
            <div key={sec.t} className="flex flex-col gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{sec.t}</span>
              <div className="flex flex-wrap gap-1.5">
                {sec.d.map(item => {
                  const isSelected = advancedFilters.some(f => f.slug === item.slug);
                  return (
                    <button key={`adv-${item.slug}`} onClick={() => toggleAdvancedFilterItem(item)}
                      className={`px-2 py-1 rounded-md text-xs font-bold border transition-all ${isSelected ? "bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-transparent border-white/20 text-zinc-400 hover:text-white hover:border-white/50"}`}
                    > {item.name} </button>
                  )
                })}
              </div>
            </div>
          ))}
          <button onClick={applyAdvancedSearch} disabled={advancedFilters.length === 0} className="w-full mt-2 py-3 rounded-lg font-black bg-white text-black hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm uppercase shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <span className="material-symbols-outlined text-[18px]">search</span> Bắt đầu lọc phim
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="pt-24 min-h-screen px-6 max-w-container-max mx-auto pb-20 bg-black">
      
      {/* 👇 ĐÃ FIX: Search Bar chuẩn Kính Mờ */}
      <div className="relative mb-8 w-full md:w-2/3 lg:w-1/2 mx-auto">
        <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/50 text-2xl">search</span>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm kiếm phim, diễn viên, đạo diễn..."
          className="w-full bg-white/10 border border-white/20 focus:border-white/60 focus:bg-white/15 text-white placeholder-white/40 rounded-full pl-14 pr-14 py-4 outline-none transition-all shadow-lg backdrop-blur-md font-medium" />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full p-1 flex items-center">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* NÚT TẮT/MỞ BỘ LỌC TRÊN MOBILE */}
        <div className="md:hidden w-full">
          <button 
            onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-white/10 border border-white/20 rounded-xl text-white font-bold hover:bg-white/20 transition-all backdrop-blur-md shadow-lg"
          >
            <span className="material-symbols-outlined">
              {isMobileFilterOpen ? "close" : "filter_alt"}
            </span>
            {isMobileFilterOpen ? "Đóng Bộ Lọc" : "Mở Bộ Lọc Phim"}
          </button>
        </div>

        {/* Sidebar Bộ Lọc */}
        <aside className={`w-full md:w-1/4 lg:w-1/5 shrink-0 h-fit bg-white/5 border border-white/10 rounded-[2rem] p-5 backdrop-blur-2xl shadow-2xl md:sticky md:top-24 ${isMobileFilterOpen ? "block" : "hidden md:block"}`}>
          <div className="flex items-center gap-2 mb-6 text-white font-black hidden md:flex drop-shadow-md">
            <span className="material-symbols-outlined">filter_alt</span>
            <span className="text-xl uppercase tracking-tighter">Bộ Lọc Phim</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-2 pb-10 custom-scrollbar">
            <AdvancedFilterSection />
            <div className="h-[1px] w-full bg-white/10 mb-6 hidden md:block"></div>
            <FilterSection title="Định Đạng" items={types} />
            <FilterSection title="Thể Loại" items={categories} />
            <FilterSection title="Quốc Gia" items={countries} />
            <FilterSection title="Năm Phát Hành" items={years} />
          </div>
        </aside>

        {/* Movie Grid */}
        <section className="flex-1 flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">
              {debouncedQuery.trim().length > 0
                ? `Kết quả cho: "${debouncedQuery}"`
                : activeFilter ? activeFilter.name : `TẤT CẢ PHIM`}
            </h2>
            <span className="text-xs text-white/50 font-bold uppercase tracking-widest bg-white/5 px-3 py-1 rounded-md">Trang {page} / {totalPages}</span>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-32">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              <div className="mt-4 text-white/50 font-bold uppercase tracking-widest animate-pulse">Đang lục kho phim...</div>
            </div>
          ) : movies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 mb-10">
                {movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
              </div>

              {/* 👇 ĐÃ FIX: Phân trang (Pagination) chuẩn Kính Mờ Trắng */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-auto pt-8 flex-wrap">
                  <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/20 hover:border-white/30 disabled:opacity-30 transition-all flex items-center justify-center backdrop-blur-md">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  {getPaginationGroup().map((p) => (
                    <button key={p} onClick={() => handlePageChange(p)} className={`w-10 h-10 rounded-full font-bold transition-all backdrop-blur-md border ${page === p ? "bg-white text-black border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/30 hover:bg-white/10"}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/20 hover:border-white/30 disabled:opacity-30 transition-all flex items-center justify-center backdrop-blur-md">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-32 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-xl">
              <span className="material-symbols-outlined text-6xl mb-4 text-white/30 drop-shadow-md">movie_off</span>
              <p className="text-white/60 font-bold uppercase tracking-widest text-center px-4">Kho phim hiện chưa có phim này, bạn quay lại sau nhé!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}