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
      navigate(`/movie/${movie.id}`);
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
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden mb-3 transition-all duration-500 transform group-hover:scale-[1.03] group-hover:-translate-y-2 shadow-lg group-hover:shadow-[0_15px_40px_-10px_rgba(var(--primary-rgb),0.5)] border border-white/5 group-hover:border-primary/50">
        
        <img alt={movie.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={movie.image} />
        
        {isResuming && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
             <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             <span className="text-[10px] text-white font-bold mt-3 animate-pulse tracking-widest uppercase">Đang nạp...</span>
          </div>
        )}

        {movie.is4K && (
          <div className="absolute top-2 right-2 bg-primary/90 backdrop-blur-md text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-lg">
            4K
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/90 text-white flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 backdrop-blur-md shadow-[0_0_30px_rgba(var(--primary-rgb),0.8)]">
            <span className="material-symbols-outlined text-3xl md:text-4xl ml-1">
              {movie.isHistory ? "resume" : "play_arrow"}
            </span>
          </div>
        </div>
        
        {/* 👇 FIX: THANH PROGRESS LƠ LỬNG KÍNH MỜ (FLOATING GLASS) */}
        {movie.isHistory && (
          <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-white/20 backdrop-blur-md z-20 rounded-full overflow-hidden border border-white/10 shadow-lg">
             <div className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),1)] rounded-full" style={{ width: '50%' }}></div>
          </div>
        )}
      </div>
      
      <h4 title={movie.title} className="font-bold text-sm md:text-[15px] text-white group-hover:text-primary transition-colors truncate tracking-tight">
        {movie.title}
      </h4>
      <p className="font-medium text-[11px] md:text-xs text-zinc-400 mt-1 uppercase tracking-widest">
        {movie.year} {movie.genre ? `• ${movie.genre}` : ''}
      </p>
    </Link>
  );
}