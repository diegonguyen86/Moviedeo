import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiGetPhimDetail } from "../api/api";
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import LoadingLogo from "./LoadingLogo";

export default function MovieCard({ movie }) {
  const navigate = useNavigate();
  const [isResuming, setIsResuming] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const { addToWatchlist, removeFromWatchlist, isSaved } = useWatchlist();
  const { showToast } = useNotification();

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
      {/* THIẾT KẾ CARD: Bọc viền trắng mờ xịn xò khi Hover */}
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-3 transition-all duration-500 transform group-hover:scale-[1.03] group-hover:-translate-y-2 shadow-lg group-hover:shadow-[0_15px_40px_-10px_rgba(255,255,255,0.15)] border border-white/5 group-hover:border-white/30">
        
        {/* HIỆU ỨNG SKELETON KHI CHƯA TẢI XONG ẢNH */}
        {!isImageLoaded && (
          <div className="absolute inset-0 bg-zinc-800 animate-pulse"></div>
        )}

        <img 
          alt={movie.title || "Unknown"} 
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`} 
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
          <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md border border-white/20 text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-lg">
            4K
          </div>
        )}

        {/* LỚP PHỦ KHI HOVER VÀ NÚT PLAY KÍNH MỜ (WHITE GLASS) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/20 border border-white/40 text-white flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.4)]">
            {/* Vòng sáng tỏa ra mờ ảo */}
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white"></div>
            <span className="material-symbols-outlined text-2xl md:text-3xl drop-shadow-md z-10" style={{ fontVariationSettings: "'FILL' 1", marginLeft: movie.isHistory ? '0' : '4px' }}>
              {movie.isHistory ? "resume" : "play_arrow"}
            </span>
          </div>

          {/* NÚT QUICK ADD TO LIST */}
          <button 
            onClick={handleToggleWatchlist}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center transform scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md hover:bg-white hover:text-black hover:scale-110 shadow-lg z-30"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isSaved(movie.id) ? "check" : "add"}
            </span>
          </button>
        </div>
        
        {/* THANH PROGRESS LƠ LỬNG KÍNH MỜ (WHITE GLOW) */}
        {movie.isHistory && (
          <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-white/20 backdrop-blur-md z-20 rounded-full overflow-hidden border border-white/10 shadow-lg">
             <div className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)] rounded-full" style={{ width: '50%' }}></div>
          </div>
        )}
      </div>
      
      {/* THÔNG TIN PHIM */}
      <h4 title={movie.title || "Đang tải..."} className="font-bold text-sm md:text-[15px] text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all truncate tracking-tight">
        {movie.title || "Đang tải..."}
      </h4>
      <p className="font-medium text-[11px] md:text-xs text-zinc-400 mt-1 uppercase tracking-widest">
        {/* GỌI HÀM LỌC CHỮ TẬP Ở ĐÂY */}
        {formatEpisodeText(movie.year)} {movie.genre ? `• ${movie.genre}` : ''}
      </p>
    </Link>
  );
}
