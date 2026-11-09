import { useState, useEffect, useMemo } from "react";
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
import { HeroSkeleton, PosterRowSkeleton } from "../components/Skeletons";
import { useDelayedLoading } from "../hooks/useDelayedLoading";

// Danh sách quốc gia chuẩn của KKPhim
const COUNTRY_LIST = [
  { name: "Phim Âu Mỹ", slug: "au-my" },
  { name: "Phim Việt Nam", slug: "viet-nam" },
  { name: "Phim Hàn Quốc", slug: "han-quoc" },
  { name: "Phim Trung Quốc", slug: "trung-quoc" },
  { name: "Phim Nhật Bản", slug: "nhat-ban" },
  { name: "Phim Thái Lan", slug: "thai-lan" },
  { name: "Phim Hồng Kông", slug: "hong-kong" },
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
          title: country.name,
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
  // Chỉ đọc cache 1 lần lúc mở trang (trước đây đọc & parse LocalStorage lại ở MỌI lần re-render)
  const [initialCache] = useState(getInitialHomeData);
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
      }, (err) => {
        console.warn("Không tải được lịch sử xem:", err);
      });

      return () => unsubscribe();
    } else {
      setWatchingHistory([]); 
    }
  }, [user, isApproved]);

  useEffect(() => {
    let isMounted = true;
    // HIỆN DẦN TỪNG MỤC: trước đây chờ ĐỦ cả 9 yêu cầu (Promise.allSettled) mới hiện trang,
    // 1 quốc gia chậm (tối đa 8s) là cả trang chủ đứng hình. Giờ mục nào về trước hiện trước.

    // 1. Top Trending do Admin chọn (banner)
    const adminTask = getDoc(doc(db, "admin_settings", "top_trending"))
      .then((snap) => {
        if (!isMounted || !snap?.exists()) return;
        const rawMovies = snap.data().movies || [];
        setCachedData("admin_top_trending", rawMovies); // Lưu cache để lần sau vào có ngay 0ms
        const formattedAdminMovies = rawMovies.map(formatMovieItem).filter(movie => movie.id && movie.image);
        if (formattedAdminMovies.length > 0) setAdminTrending(formattedAdminMovies);
      })
      .catch((error) => console.warn("Không tải được Top Trending:", error));

    // 2. Phim Chiếu Rạp -> có là tắt loading ngay
    const trendingTask = apiGetPhimTheoDanhSach('phim-chieu-rap', 1)
      .then((res) => {
        if (!isMounted) return;
        const trendingItems = res?.data?.items || res?.items || [];
        if (trendingItems.length > 0) {
          setTrending(sortMoviesByYearDesc(trendingItems.map(formatMovieItem)));
        }
        setLoading(false);
      })
      .catch(() => {});

    // 3. Phim theo quốc gia: mục nào về thì chèn vào đúng thứ tự
    const countryTasks = COUNTRY_LIST.map((country, index) =>
      apiGetPhimTheoQuocGia(country.slug, 1)
        .then((res) => {
          if (!isMounted) return;
          const items = res?.data?.items || res?.items || [];
          if (items.length === 0) return;
          const section = {
            order: index,
            title: country.name,
            movies: sortMoviesByYearDesc(items.map(formatMovieItem)),
            viewAllState: { type: 'quoc-gia', slug: country.slug, title: country.name }
          };
          setCountrySections((prev) => {
            const others = prev.filter((s) => s.title !== section.title);
            return [...others, section].sort((a, b) => (a.order ?? COUNTRY_LIST.findIndex(c => a.title.endsWith(c.name))) - (b.order ?? COUNTRY_LIST.findIndex(c => b.title.endsWith(c.name))));
          });
        })
        .catch(() => {})
    );

    // Lưới an toàn: dù mọi thứ lỗi vẫn tắt loading
    Promise.allSettled([adminTask, trendingTask, ...countryTasks]).then(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  const showSkeleton = useDelayedLoading(loading);

  const heroMovies = useMemo(
    () => (adminTrending.length > 0 ? adminTrending : trending).slice(0, 5),
    [adminTrending, trending]
  );

  return (
    <main className="overflow-hidden pb-24">
      {/* Banner: 5 phim thịnh hành. Chưa có dữ liệu thì khung chờ đúng hình (chờ 300ms mới hiện, tránh chớp) */}
      {heroMovies.length > 0
        ? <HeroBanner movies={heroMovies} />
        : loading && (showSkeleton ? <HeroSkeleton /> : <div className="min-h-[62vh] md:min-h-[78vh]" />)}

      <div className="mt-6 space-y-10 md:mt-8 md:space-y-12">
        {/* Xem tiếp: việc chính số 1, đứng ngay dưới banner */}
        {watchingHistory.length > 0 && (
          <MovieCarousel title="Xem tiếp" movies={watchingHistory} icon="history" tone={1} />
        )}

        {trending.length > 0 ? (
          <MovieCarousel
            title="Phim chiếu rạp mới"
            movies={trending}
            icon="theaters"
            tone={2}
            viewAllState={{ type: 'danh-sach', slug: 'phim-chieu-rap', title: 'Phim Chiếu Rạp' }}
          />
        ) : (loading && showSkeleton && <PosterRowSkeleton />)}

        {loading && showSkeleton && countrySections.length === 0 && <PosterRowSkeleton />}

        {/* Danh sách các quốc gia */}
        {countrySections.map((section) => (
          <MovieCarousel 
            key={section.title} 
            title={section.title} 
            movies={section.movies} 
            viewAllState={section.viewAllState}
            icon="public"
            tone={3}
          />
        ))}
      </div>

      <WelcomePopup />
    </main>
  );
}

export default Home;
