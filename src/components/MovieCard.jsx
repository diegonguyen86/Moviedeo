import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiGetPhimDetail } from "../api/api";

export default function MovieCard({ movie }) {
  const navigate = useNavigate();
  const [isResuming, setIsResuming] = useState(false);

  const getFullImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `https://phimimg.com/${url}`;
  };

  // HÀM TÀNG HÌNH: Lấy link phim ngầm và bay thẳng vào VideoPlayer
  const handleResume = async (e) => {
    e.preventDefault(); 
    if (isResuming) return;
    setIsResuming(true);

    try {
      const data = await apiGetPhimDetail(movie.id);
      if (data && data.status) {
        const allServers = data.episodes || [];
        let targetEp = null;
        let targetServerIdx = 0;

        // Tìm tập phim đang xem dở
        for (let i = 0; i < allServers.length; i++) {
          const eps = allServers[i].server_data || allServers[i].items || [];
          const found = eps.find(ep => ep.name === movie.rawEpName);
          if (found) { targetEp = found; targetServerIdx = i; break; }
        }

        // Nếu không tìm thấy thì lấy tập 1
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
              cloudProgress: movie.progress // GỬI TIẾN ĐỘ ĐÁM MÂY SANG TRÌNH PHÁT
            }
          });
        }
      }
    } catch (error) {
      navigate(`/movie/${movie.id}`); // Lỗi thì cứ vứt về trang chi tiết an toàn
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <Link 
      to={`/movie/${movie.id}`} 
      onClick={movie.isHistory ? handleResume : undefined}
      className="group cursor-pointer block relative"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 transition-all duration-300 transform group-hover:scale-[1.02] group-hover:-translate-y-1 group-hover:shadow-[0_10px_30px_-10px_rgba(143,136,199,0.5)]">
        <img alt={movie.title} className="w-full h-full object-cover" src={movie.image} />
        
        {/* LỚP MẶT NẠ LOADING KHI BẤM VÀO */}
        {isResuming && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             <span className="text-[10px] text-white font-bold mt-2 animate-pulse">Đang nạp phim...</span>
          </div>
        )}

        {movie.is4K && (
          <div className="absolute top-2 right-2 bg-primary text-on-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">4K</div>
        )}
        <div className="absolute inset-0 bg-transparent group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/90 text-on-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(199,191,255,0.5)]">
            <span className="material-symbols-outlined ml-1">{movie.isHistory ? "resume" : "play_arrow"}</span>
          </div>
        </div>
        
        {/* THANH ĐANG XEM DỞ DƯỚI CÙNG CARD */}
        {movie.isHistory && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-900">
             <div className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]" style={{ width: '50%' }}></div>
          </div>
        )}
      </div>
      
      <h4 title={movie.title} className="font-label-md text-[14px] text-text-primary group-hover:text-primary transition-colors truncate">
        {movie.title}
      </h4>
      <p className="font-label-sm text-[12px] text-text-secondary">
        {movie.year} {movie.genre ? `• ${movie.genre}` : ''}
      </p>
    </Link>
  );
}