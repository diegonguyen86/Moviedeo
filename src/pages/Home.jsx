import { useState, useEffect } from "react";
import HeroBanner from "../components/HeroBanner";
import MovieCarousel from "../components/MovieCarousel";
import WelcomePopup from "../components/WelcomePopup";
import { 
  apiGetPhimTheoDanhSach, 
  apiGetPhimTheoQuocGia, 
  formatMovieItem,
  getCachedData,
  setCachedData
} from "../api/api";

// --- IMPORT FIREBASE ---
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import LoadingLogo from "../components/LoadingLogo";

// Danh sách quốc gia chuẩn của KKPhim
const COUNTRY_LIST = [
  { name: "Siêu Phẩm Âu Mỹ", slug: "au-my", emoji: "🌎" },
  { name: "Phim Việt Nam", slug: "viet-nam", emoji: "🇻🇳" },
  { name: "Phim Hàn Quốc", slug: "han-quoc", emoji: "🍜" },
  { name: "Phim Trung Quốc", slug: "trung-quoc", emoji: "⚔️" },
  { name: "Nhật Bản", slug: "nhat-ban", emoji: "🍣" },
  { name: "Thái Lan", slug: "thai-lan", emoji: "🐘" },
  { name: "Hồng Kông", slug: "hong-kong", emoji: "🏙️" },
];

const sortMoviesByYearDesc = (movies) => {
  return [...movies].sort((a, b) => {
    const getYear = (str) => {
      const match = String(str).match(/\d{4}/);
      return match ? parseInt(match[0]) : 0;
    };
    return getYear(b.year) - getYear(a.year);
  });
};

// Hàm đọc dữ liệu đệm ban đầu để hiển thị trang chủ NGAY LẬP TỨC trong 0ms (SWR Pattern)
const getInitialHomeData = () => {
  try {
    const cachedAdmin = getCachedData("admin_top_trending");
    const cachedChieuRap = getCachedData("/v1/api/danh-sach/phim-chieu-rap?page=1");
    
    let admin = [];
    if (cachedAdmin && Array.isArray(cachedAdmin)) {
      admin = cachedAdmin.map(formatMovieItem).filter(m => m.id && m.image);
    }
    
    let chieuRap = [];
    const crItems = cachedChieuRap?.data?.items || cachedChieuRap?.items || [];
    if (crItems.length > 0) {
      chieuRap = sortMoviesByYearDesc(crItems.map(formatMovieItem));
    }

    const countries = COUNTRY_LIST.map(country => {
      const cData = getCachedData(`/v1/api/quoc-gia/${country.slug}?page=1`);
      const items = cData?.data?.items || cData?.items || [];
      if (items.length > 0) {
        return {
          title: `${country.emoji} ${country.name}`,
          movies: sortMoviesByYearDesc(items.map(formatMovieItem)),
          viewAllState: { type: 'quoc-gia', slug: country.slug, title: country.name }
        };
      }
      return null;
    }).filter(Boolean);

    return {
      adminTrending: admin,
      trending: chieuRap,
      countrySections: countries,
      hasCache: admin.length > 0 || chieuRap.length > 0 || countries.length > 0
    };
  } catch (e) {
    return { adminTrending: [], trending: [], countrySections: [], hasCache: false };
  }
};

function Home() {
  const initialCache = getInitialHomeData();
  const [adminTrending, setAdminTrending] = useState(initialCache.adminTrending); 
  const [trending, setTrending] = useState(initialCache.trending);       
  const [countrySections, setCountrySections] = useState(initialCache.countrySections);
  // Nếu đã có cache thì render UI ngay trong 0ms, không bắt người dùng nhìn màn hình loading!
  const [loading, setLoading] = useState(!initialCache.hasCache);

  // --- STATE & AUTH ---
  const [watchingHistory, setWatchingHistory] = useState([]);
  const { user, isApproved } = useAuth(); 

  // Lấy lịch sử xem phim từ Firebase (Real-time)
  useEffect(() => {
    if (user && isApproved) { 
      const q = query(
        collection(db, "users", user.uid, "watchHistory"),
        orderBy("lastWatched", "desc"),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const movies = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.slug || doc.id, 
            docId: doc.id,
            title: data.title,
            image: data.image,
            year: data.epName || data.year || "2024",
            isHistory: true, 
            rawEpName: data.epName,
            progress: data.progress
          };
        });
        setWatchingHistory(movies);
      });

      return () => unsubscribe();
    } else {
      setWatchingHistory([]); 
    }
  }, [user, isApproved]);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // TẢI SONG SONG 100% (Loại bỏ hoàn toàn Waterfall gây trễ 1-2 giây)
        const [adminRes, trendingRes, ...countryResults] = await Promise.allSettled([
          getDoc(doc(db, "admin_settings", "top_trending")),
          apiGetPhimTheoDanhSach('phim-chieu-rap', 1),
          ...COUNTRY_LIST.map(country => apiGetPhimTheoQuocGia(country.slug, 1))
        ]);

        // 1. Cập nhật Top Trending Admin
        if (adminRes.status === "fulfilled" && adminRes.value?.exists()) {
          const rawMovies = adminRes.value.data().movies || [];
          setCachedData("admin_top_trending", rawMovies); // Lưu cache để lần sau vào có ngay 0ms
          const formattedAdminMovies = rawMovies
            .map(formatMovieItem)
            .filter(movie => movie.id && movie.image);
          if (formattedAdminMovies.length > 0) {
            setAdminTrending(formattedAdminMovies);
          }
        }

        // 2. Cập nhật Phim Chiếu Rạp
        if (trendingRes.status === "fulfilled" && trendingRes.value) {
          const trendingItems = trendingRes.value?.data?.items || trendingRes.value?.items || [];
          if (trendingItems.length > 0) {
            const formatted = trendingItems.map(formatMovieItem);
            setTrending(sortMoviesByYearDesc(formatted));
          }
        }

        // 3. Cập nhật Phim Theo Quốc Gia
        const compiled = COUNTRY_LIST.map((country, index) => {
          const res = countryResults[index];
          if (res?.status === "fulfilled" && res.value) {
            const items = res.value?.data?.items || res.value?.items || [];
            if (items.length > 0) {
              const formatted = items.map(formatMovieItem);
              return {
                title: `${country.emoji} ${country.name}`,
                movies: sortMoviesByYearDesc(formatted),
                viewAllState: { type: 'quoc-gia', slug: country.slug, title: country.name }
              };
            }
          }
          return null;
        }).filter(Boolean);

        if (compiled.length > 0) {
          setCountrySections(compiled);
        }
      } catch (error) {
        console.error("Lỗi trang chủ:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  if (loading) {
    return (
      <div className="pt-32 min-h-screen bg-black text-center text-white flex flex-col items-center justify-center">
        <LoadingLogo className="w-16 h-16 mb-4" />
        <p className="text-[13px] font-bold animate-pulse text-white/60 tracking-widest uppercase mt-2">Đang chuẩn bị rạp phim...</p>
      </div>
    );
  }

  return (
    <main className="pb-24 overflow-hidden bg-black">
      {/* Banner chính: Băng chuyền 5 phim Top Trending */}
      {adminTrending.length > 0 ? (
        <HeroBanner movies={adminTrending.slice(0, 5)} />
      ) : (
        trending.length > 0 && <HeroBanner movies={trending.slice(0, 5)} />
      )}

      <div className="space-y-12 mt-8">
        {/* Lịch sử xem: Hiện lên trên cùng nếu có dữ liệu */}
        {watchingHistory.length > 0 && (
          <MovieCarousel 
            title="🕒 Phim Bạn Đang Xem" 
            movies={watchingHistory} 
          />
        )}

        {/* Phim Chiếu Rạp */}
        {trending.length > 0 && (
          <MovieCarousel 
            title="🔥 Phim Chiếu Rạp Mới Nhất" 
            movies={trending} 
            viewAllState={{ type: 'danh-sach', slug: 'phim-chieu-rap', title: 'Phim Chiếu Rạp' }}
          />
        )}

        {/* Danh sách các quốc gia */}
        {countrySections.map((section) => (
          <MovieCarousel 
            key={section.title} 
            title={section.title} 
            movies={section.movies} 
            viewAllState={section.viewAllState}
          />
        ))}
      </div>

      <WelcomePopup />
    </main>
  );
}

export default Home;
