import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiGetPhimDetail } from "../api/api";
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import LoadingLogo from "./LoadingLogo";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { deleteDoc, doc } from "firebase/firestore";

export default function MovieCard({ movie }) {
  const navigate = useNavigate();
  const [isResuming, setIsResuming] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const { addToWatchlist, removeFromWatchlist, isSaved } = useWatchlist();
  const { showToast, showConfirm } = useNotification();
  const { user } = useAuth();

  // 👇 Lớp bảo vệ số 1: Tránh lỗi crash nếu thẻ này bị gọi mà không truyền dữ liệu
  if (!movie) return null;

  const getFullImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `https://phimimg.com/${url}`;
  };

  // 👇 HÀM DỌN DẸP LỖI "TẬP: TẬP": Lọc mọi ký tự thừa, chỉ giữ lại đúng 1 chữ TẬP
  const formatEpisodeText = (text) => {
    if (!text) return "";
    const str = text.toString();
    // Nếu chỉ là số năm (ví dụ: 2024, 2023) thì để nguyên
    if (/^\d{4}$/.test(str)) return str;
    // Nếu là tập phim, xóa hết chữ "tập" và ":" bị lặp, sau đó ghép lại cho chuẩn
    const cleanText = str.replace(/tập/gi, "").replace(/:/g, "").trim();
    return `TẬP ${cleanText}`;
  };

  const handleToggleWatchlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!movie || !movie.id) return;
    
    if (isSaved(movie.id)) {
      removeFromWatchlist(movie.id);
      showToast("Đã bỏ khỏi danh sách", "info");
    } else {
      addToWatchlist(movie);
      showToast("Đã thêm vào danh sách", "success");
    }
  };

  const handleDeleteHistory = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !movie.docId) return;
    
    showConfirm("Xóa phim này khỏi danh sách đang xem?", async () => {
      try {
        // Chỉ xóa trên Firebase để ẩn khỏi trang chủ
        // Cố tình giữ lại LocalStorage để phục hồi tiến trình "zombie" nếu user muốn xem lại
        await deleteDoc(doc(db, "users", user.uid, "watchHistory", movie.docId));
        showToast("Đã xóa khỏi trang chủ", "success");
      } catch (error) {
        console.error("Lỗi xóa phim:", error);
        showToast("Lỗi khi xóa phim", "error");
      }
    });
  };

  const handleResume = async (e) => {
    e.preventDefault(); 
    if (isResuming) return;
    setIsResuming(true);

    try {
      // 👇 Bảo vệ khi Resume: Không có ID thì dừng
      if (!movie.id) return;
      
      const data = await apiGetPhimDetail(movie.id);
      if (data && data.status) {
        const allServers = data.episodes || [];
        let targetEp = null;
        let targetServerIdx = 0;

        for (let i = 0; i < allServers.length; i++) {
          const eps = allServers[i].server_data || allServers[i].items || [];
          const found = eps.find(ep => ep.name === movie.rawEpName);
          if (found) { targetEp = found; targetServerIdx = i; break; }
        }

        if (!targetEp) targetEp = (allServers[0]?.server_data || allServers[0]?.items || [])[0];

        if (targetEp) {
          navigate(`/play/${data.movie.slug}`, {
            state: {
              videoUrl: targetEp.link_m3u8 || targetEp.m3u8 || "",
              embedFallback: targetEp.link_embed || targetEp.embed || "",
              movieName: data.movie.name,
              epName: targetEp.name,
              allServers: allServers,
              currentServerIndex: targetServerIdx,
              posterUrl: getFullImageUrl(data.movie.poster_url),
              cloudProgress: movie.progress
            }
          });
        }
      }
    } catch (error) {
      navigate(movie.id ? `/movie/${movie.id}` : "#");
    } finally {
      setIsResuming(false);
    }
  };

  // 👇 Lớp bảo vệ số 2 (Quan trọng nhất): Chỉ gán link nếu có ID, không thì gán thành "#"
  const safeLink = movie.id ? `/movie/${movie.id}` : "#";

  return (
    <Link 
      to={safeLink} 
      onClick={movie.isHistory ? handleResume : undefined}
      className={`group cursor-pointer block relative ${!movie.id ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* THIẾT KẾ CARD: Phẳng, không viền glass, bo góc sắc nét hơn */}
      <div className="relative aspect-[2/3] rounded-md overflow-hidden mb-2 transition-all duration-300 transform group-hover:scale-[1.02] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        
        {/* HIỆU ỨNG SKELETON KHI CHƯA TẢI XONG ẢNH */}
        {!isImageLoaded && (
          <div className="absolute inset-0 bg-zinc-800 animate-pulse"></div>
        )}

        <img 
          alt={movie.title || "Unknown"} 
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`} 
          src={movie.image || "/fallback-image.jpg"} 
        />
        
        {/* LỚP LOADING ĐỒNG BỘ TRẮNG */}
        {isResuming && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
             <LoadingLogo className="w-12 h-12" />
             <span className="text-[10px] text-white font-bold mt-3 animate-pulse tracking-widest uppercase">Đang nạp...</span>
          </div>
        )}

        {/* 4K BADGE KÍNH MỜ */}
        {movie.is4K && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
            4K
          </div>
        )}

        {/* NHÃN TẬP PHIM (BADGE GÓC DƯỚI TRÁI) NHƯ VIEFLIX */}
        {movie.year && (
          <div className="absolute bottom-2 left-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-1.5 py-0.5 rounded-[3px] text-[10px] md:text-[11px] font-bold shadow-md z-30">
            {formatEpisodeText(movie.year)}
          </div>
        )}

        {/* LỚP PHỦ KHI HOVER VÀ NÚT PLAY */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20">
          <div className="relative w-12 h-12 rounded-full bg-yellow-500/90 text-black flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1", marginLeft: movie.isHistory ? '0' : '2px' }}>
              {movie.isHistory ? "resume" : "play_arrow"}
            </span>
          </div>

          {/* NÚT TÙY CHỌN */}
          {movie.isHistory ? (
            <button 
              onClick={handleDeleteHistory}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center transform opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-600 z-30"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          ) : (
            <button 
              onClick={handleToggleWatchlist}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center transform opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-yellow-500 hover:text-black z-30"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSaved(movie.id) ? "check" : "add"}
              </span>
            </button>
          )}
        </div>
        
        {/* THANH PROGRESS LƠ LỬNG MÀU VÀNG CAM */}
        {movie.isHistory && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20 overflow-hidden">
             <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500" style={{ width: '50%' }}></div>
          </div>
        )}
      </div>
      
      {/* THÔNG TIN PHIM */}
      <h4 title={movie.title || "Đang tải..."} className="font-bold text-[13px] md:text-[14px] leading-snug text-zinc-100 group-hover:text-yellow-400 transition-colors line-clamp-2 mt-1">
        {movie.title || "Đang tải..."}
      </h4>
    </Link>
  );
}
