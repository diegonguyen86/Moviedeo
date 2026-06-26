import { useState, useEffect } from "react";
import HeroBanner from "../components/HeroBanner";
import MovieCarousel from "../components/MovieCarousel";
import { 
  apiGetPhimTheoDanhSach, 
  apiGetPhimTheoQuocGia, 
  formatMovieItem 
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

function Home() {
  // Đổi tên state từ tmdbTrending thành adminTrending cho chuẩn ý nghĩa
  const [adminTrending, setAdminTrending] = useState([]); 
  const [trending, setTrending] = useState([]);       
  const [countrySections, setCountrySections] = useState([]);
  const [loading, setLoading] = useState(true);

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
        setLoading(true);
        
        // 👇 ĐÃ FIX CHỖ NÀY: Dịch và lọc dữ liệu từ Admin để tương thích với MovieCard / HeroBanner
        const adminDocRef = doc(db, "admin_settings", "top_trending");
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          const rawMovies = adminDocSnap.data().movies || [];
          
          const formattedAdminMovies = rawMovies
            .map(formatMovieItem)
            .filter(movie => movie.id && movie.image); // Lọc bỏ nếu lỡ có phim bị lỗi trống id hoặc image
            
          setAdminTrending(formattedAdminMovies);
        }

        // 2. Lấy Phim Chiếu Rạp
        const trendingRes = await apiGetPhimTheoDanhSach('phim-chieu-rap', 1);
        const trendingItems = trendingRes?.data?.items || trendingRes?.items || [];
        if (trendingItems.length > 0) {
          const formatted = trendingItems.map(formatMovieItem);
          setTrending(sortMoviesByYearDesc(formatted));
        }

        // 3. Lấy Phim Theo Quốc Gia
        const countryPromises = COUNTRY_LIST.map(country => apiGetPhimTheoQuocGia(country.slug, 1));
        const results = await Promise.allSettled(countryPromises);
        const compiled = COUNTRY_LIST.map((country, index) => {
          const res = results[index];
          if (res.status === "fulfilled" && res.value) {
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

        setCountrySections(compiled);
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
      {/* Banner chính: Ưu tiên chiếu phim Top 1 từ danh sách Admin */}
      {adminTrending.length > 0 ? (
        <HeroBanner movie={adminTrending[0]} />
      ) : (
        trending.length > 0 && <HeroBanner movie={trending[0]} />
      )}

      <div className="space-y-12 mt-8">
        {/* Lịch sử xem: Hiện lên trên cùng nếu có dữ liệu */}
        {watchingHistory.length > 0 && (
          <MovieCarousel 
            title="🕒 Phim Bạn Đang Xem" 
            movies={watchingHistory} 
          />
        )}

        {/* Top Trending do Admin tự cấu hình */}
        {adminTrending.length > 0 && (
          <MovieCarousel 
            title="✨ Top Trending" 
            movies={adminTrending} 
            isTop10={true}
            startNumber={1}
          />
        )}

        {/* Phim Chiếu Rạp */}
        {trending.length > 0 && (
          <MovieCarousel 
            title="🍿 Phim Chiếu Rạp" 
            movies={trending} 
            viewAllState={{ type: 'danh-sach', slug: 'phim-chieu-rap', title: 'Phim Chiếu Rạp' }}
          />
        )}
        
        {/* Danh sách các quốc gia hot */}
        {countrySections.map((section, index) => (
          <MovieCarousel 
            key={index} 
            title={section.title} 
            movies={section.movies} 
            viewAllState={section.viewAllState} 
          />
        ))}
      </div>
    </main>
  );
}

export default Home;
