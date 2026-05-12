import { useState, useEffect } from "react";
import HeroBanner from "../components/HeroBanner";
import MovieCarousel from "../components/MovieCarousel";
import { 
  apiGetPhimTheoDanhSach, 
  apiGetPhimTheoQuocGia, 
  apiGetTMDBTrending, 
  apiSearchByTitle,
  formatMovieItem 
} from "../api/api";

// --- IMPORT FIREBASE ---
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

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

function Home() {
  const [tmdbTrending, setTmdbTrending] = useState([]); 
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
            title: data.title,
            image: data.image,
            year: data.epName ? `Tập: ${data.epName}` : (data.year || "2024")
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
        
        // 1. Lấy dữ liệu Trending Thế giới (TMDB) & Khớp với KKPhim
        const tmdbRes = await apiGetTMDBTrending();
        if (tmdbRes?.results) {
          const mappingPromises = tmdbRes.results.slice(0, 10).map(async (movie) => {
            const searchRes = await apiSearchByTitle(movie.original_title || movie.title);
            // THÍCH ỨNG KKPHIM: Lấy từ searchRes.data.items hoặc searchRes.items
            const items = searchRes?.data?.items || searchRes?.items || [];
            if (items.length > 0) {
              return formatMovieItem(items[0]);
            }
            return null;
          });
          const mappedResults = (await Promise.all(mappingPromises)).filter(Boolean);
          setTmdbTrending(mappedResults);
        }

        // 2. Lấy Phim Đang Chiếu (KKPhim dùng 'phim-le' hoặc 'phim-bo')
        const trendingRes = await apiGetPhimTheoDanhSach('phim-le', 1);
        const trendingItems = trendingRes?.data?.items || trendingRes?.items || [];
        if (trendingItems.length > 0) {
          setTrending(trendingItems.map(formatMovieItem));
        }

        // 3. Lấy Phim Theo Quốc Gia
        const countryPromises = COUNTRY_LIST.map(country => apiGetPhimTheoQuocGia(country.slug, 1));
        const results = await Promise.allSettled(countryPromises);
        const compiled = COUNTRY_LIST.map((country, index) => {
          const res = results[index];
          if (res.status === "fulfilled" && res.value) {
            // THÍCH ỨNG KKPHIM: Tương tự, chui vào trong .data.items
            const items = res.value?.data?.items || res.value?.items || [];
            if (items.length > 0) {
              return {
                title: `${country.emoji} ${country.name}`,
                movies: items.map(formatMovieItem),
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
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-bold animate-pulse text-primary">🍿 Đang chuẩn bị phim, đợi tí nha Khôi...</p>
      </div>
    );
  }

  return (
    <main className="pb-24 overflow-hidden bg-black">
      {/* Banner chính */}
      {tmdbTrending.length > 0 ? (
        <HeroBanner movie={tmdbTrending[0]} />
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

        {/* Top Trending Thế giới */}
        {tmdbTrending.length > 0 && (
          <MovieCarousel 
            title="✨ Top Trending" 
            movies={tmdbTrending} 
            viewAllState={{ type: 'trending-tmdb', title: 'Trending Thế Giới' }} 
          />
        )}

        {/* Phim Lẻ Mới (Thay cho phim đang chiếu) */}
        {trending.length > 0 && (
          <MovieCarousel 
            title="🔥 Phim Lẻ Mới" 
            movies={trending} 
            viewAllState={{ type: 'danh-sach', slug: 'phim-le', title: 'Phim Lẻ Mới' }} 
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