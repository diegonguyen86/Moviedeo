import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGetPhimDetail, apiGetTrailer, apiGetRelatedSeasons } from "../api/api"; 
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import TrailerModal from "../components/TrailerModal";
import CommentSection from "../components/CommentSection";

export default function MovieDetail() {
  const { showToast } = useNotification();
  const { id } = useParams();
  const navigate = useNavigate();
  const [movieDetails, setMovieDetails] = useState(null);
  const [movieServers, setMovieServers] = useState([]); 
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [relatedSeasons, setRelatedSeasons] = useState([]);

  // Trailer & Watchlist state
  const [trailerKey, setTrailerKey] = useState(null);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isTrailerLoading, setIsTrailerLoading] = useState(false);
  const { addToWatchlist, removeFromWatchlist, isSaved } = useWatchlist();

  const handleWatchTrailer = async () => {
    if (trailerKey) {
      setIsTrailerOpen(true);
      return;
    }
    setIsTrailerLoading(true);
    const key = await apiGetTrailer(movieDetails.origin_name || movieDetails.name);
    setIsTrailerLoading(false);
    if (key) {
      setTrailerKey(key);
      setIsTrailerOpen(true);
    } else {
      showToast("Chưa tìm thấy Trailer cho bộ phim này!", "error");
    }
  };

  const getFullImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `https://phimimg.com/${url}`;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedServerIndex(0);
    const fetchMovieData = async () => {
      setLoading(true);
      try {
        const data = await apiGetPhimDetail(id);
        if (data && data.status === true) {
          setMovieDetails(data.movie);
          setMovieServers(data.episodes || []); 
          
          apiGetRelatedSeasons(data.movie.name, data.movie.origin_name).then(seasons => {
             setRelatedSeasons(seasons);
          });
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu phim:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovieData();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-white font-bold animate-pulse text-2xl mt-20">🍿 Đang chuẩn bị rạp phim...</div>;
  if (!movieDetails) return <div className="p-8 text-center text-white font-bold text-xl mt-20">Không tìm thấy phim này rồi!</div>;

  // LẤY DỮ LIỆU AN TOÀN BAO THẦU CẢ 2 CHUẨN KKPHIM & NGUONC
  const rawEpisodes = movieServers[selectedServerIndex]?.server_data || movieServers[selectedServerIndex]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  return (
    <main className="pb-20 min-h-screen text-zinc-300" style={{ backgroundColor: '#0A0A0A' }}>
      <TrailerModal isOpen={isTrailerOpen} onClose={() => setIsTrailerOpen(false)} youtubeKey={trailerKey} />
      
      {/* ẢNH NỀN KHỔNG LỒ */}
      <section className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden">
        <img className="w-full h-full object-cover opacity-30 object-top" src={getFullImageUrl(movieDetails.poster_url)} alt={movieDetails.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-transparent" />
      </section>

      {/* NỘI DUNG CHÍNH (2 CỘT) */}
      <section className="px-4 md:px-12 -mt-64 relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 max-w-container-max mx-auto">
        
        {/* CỘT TRÁI: POSTER & THÔNG TIN */}
        <div className="md:col-span-3 space-y-6">
          <div className="rounded-lg overflow-hidden border border-white/5 shadow-2xl relative aspect-[2/3] w-2/3 md:w-full mx-auto md:mx-0">
            <img src={getFullImageUrl(movieDetails.thumb_url)} className="w-full h-full object-cover" alt="Poster" />
            <div className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
              {movieDetails.quality}
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-black text-white leading-tight">{movieDetails.name}</h1>
            <h2 className="text-sm text-zinc-500 font-medium mt-1 uppercase tracking-wider">{movieDetails.origin_name || movieDetails.name}</h2>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded border border-yellow-500/30">IMDb N/A</span>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">{movieDetails.quality}</span>
            <span className="bg-white/10 text-white px-2 py-1 rounded border border-white/10">{movieDetails.year}</span>
            <span className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 px-2 py-1 rounded border border-pink-500/30">
              {movieDetails.episode_current}
            </span>
          </div>

          {movieDetails.category && (
            <div className="flex flex-wrap gap-2 text-[11px] font-medium">
              {movieDetails.category.map(cat => (
                <span key={cat.id} className="text-zinc-400 bg-white/5 px-2 py-1 rounded-full">{cat.name}</span>
              ))}
            </div>
          )}

          <div className="space-y-4 text-[13px]">
            <div>
              <h3 className="font-bold text-white mb-1 uppercase tracking-widest text-[11px]">Giới thiệu:</h3>
              <div className="text-zinc-400 leading-relaxed line-clamp-6" dangerouslySetInnerHTML={{ __html: movieDetails.content || "Chưa có nội dung mô tả." }} />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <span className="text-zinc-500 block mb-1 text-[10px] uppercase">Thời lượng</span>
                <span className="text-zinc-200 font-medium">{movieDetails.time}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1 text-[10px] uppercase">Quốc Gia</span>
                <span className="text-zinc-200 font-medium">{Array.isArray(movieDetails.country) ? movieDetails.country.map(c => c.name).join(", ") : "Đang cập nhật"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500 block mb-1 text-[10px] uppercase">Đạo diễn</span>
                <span className="text-zinc-200 font-medium">{Array.isArray(movieDetails.director) ? movieDetails.director.join(", ") : "Đang cập nhật"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500 block mb-1 text-[10px] uppercase">Diễn viên</span>
                <span className="text-zinc-200 font-medium">{Array.isArray(movieDetails.actor) ? movieDetails.actor.join(", ") : "Đang cập nhật"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: HÀNH ĐỘNG & DANH SÁCH TẬP */}
        <div className="md:col-span-9 md:pl-8">
          
          {/* NÚT HÀNH ĐỘNG */}
          <div className="flex items-center gap-6 mb-12">
            <button 
              onClick={() => {
                if (currentEpisodes.length > 0) {
                  const ep = currentEpisodes[0];
                  navigate(`/play/${id}`, { 
                    state: { 
                      videoUrl: ep.link_m3u8 || ep.m3u8 || "", 
                      embedFallback: ep.link_embed || ep.embed || "", 
                      movieName: movieDetails.name, 
                      epName: ep.name,
                      allServers: movieServers, 
                      currentServerIndex: selectedServerIndex, 
                      posterUrl: getFullImageUrl(movieDetails.poster_url)
                    } 
                  });
                }
              }}
              className="flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-10 py-4 rounded-full font-black text-lg transition-transform hover:scale-105 shadow-[0_0_30px_rgba(219,39,119,0.4)]"
            >
              <span className="material-symbols-outlined filled text-3xl">play_circle</span>
              XEM NGAY
            </button>
            
            <button onClick={handleWatchTrailer} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition-colors group">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <span className="material-symbols-outlined text-xl">smart_display</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">Trailer</span>
            </button>

            <button onClick={() => isSaved(id) ? removeFromWatchlist(id) : addToWatchlist({ slug: id, name: movieDetails.name, thumb_url: getFullImageUrl(movieDetails.thumb_url), year: movieDetails.year })} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-pink-400 transition-colors group">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: isSaved(id) ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{isSaved(id) ? "Đã Lưu" : "Yêu Thích"}</span>
            </button>
          </div>

          {/* TABS (TẬP PHIM) */}
          <div className="flex items-center gap-8 border-b border-white/10 mb-8">
            <div className="text-pink-500 font-bold text-sm tracking-widest uppercase border-b-2 border-pink-500 pb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
              Tập Phim
            </div>
            <div className="text-zinc-500 font-bold text-sm tracking-widest uppercase pb-4 flex items-center gap-2 hover:text-white cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-lg">info</span>
              Thông Tin
            </div>
          </div>

          {/* SEASON SELECTOR */}
          {relatedSeasons.length > 1 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                <span className="material-symbols-outlined text-lg">layers</span>
                PHẦN PHIM (SEASONS)
              </div>
              <div className="flex flex-wrap gap-3">
                {relatedSeasons.map(season => {
                  const isActive = season.id === id;
                  return (
                    <button 
                      key={season.id}
                      onClick={() => !isActive && navigate(`/movie/${season.id}`)}
                      className={`px-6 py-2.5 rounded border text-sm font-bold transition-all ${isActive ? "bg-white/10 border-white text-white" : "bg-transparent border-white/10 text-zinc-500 hover:border-white/30 hover:text-white"}`}
                    >
                      Phần {season.seasonNumber}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* MÁY CHỦ PHÁT (SERVERS) */}
          {movieServers.length > 1 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                <span className="material-symbols-outlined text-lg">dns</span>
                MÁY CHỦ PHÁT
              </div>
              <div className="flex flex-wrap gap-3">
                {movieServers.map((server, index) => (
                  <button key={index} onClick={() => setSelectedServerIndex(index)}
                    className={`px-6 py-2.5 rounded border text-sm font-bold transition-all flex items-center gap-2 ${selectedServerIndex === index ? "bg-pink-500/20 border-pink-500 text-pink-400" : "bg-transparent border-white/10 text-zinc-500 hover:border-white/30 hover:text-white"}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{selectedServerIndex === index ? "check_circle" : "tv"}</span>
                    {server.server_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DANH SÁCH TẬP */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                <span className="material-symbols-outlined text-lg">view_module</span>
                DANH SÁCH TẬP
                <span className="bg-white/10 text-zinc-400 px-2 py-0.5 rounded ml-2">{currentEpisodes.length} Tập</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {currentEpisodes.map((ep) => (
                <button key={ep.slug}
                  onClick={() => {
                    navigate(`/play/${id}`, { 
                      state: { 
                        videoUrl: ep.link_m3u8 || ep.m3u8 || "", 
                        embedFallback: ep.link_embed || ep.embed || "", 
                        movieName: movieDetails.name, 
                        epName: ep.name,
                        allServers: movieServers, 
                        currentServerIndex: selectedServerIndex, 
                        posterUrl: getFullImageUrl(movieDetails.poster_url)
                      } 
                    });
                  }}
                  className="h-12 bg-white/5 hover:bg-white/20 border border-white/5 hover:border-white/30 text-zinc-300 hover:text-white rounded flex items-center justify-center font-bold text-sm transition-all"
                >
                  {ep.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* BÌNH LUẬN */}
          <div className="bg-white/5 border border-white/5 p-6 rounded-xl">
            <div className="flex items-center gap-2 text-white font-bold text-lg mb-6">
              <span className="material-symbols-outlined">chat_bubble</span>
              Bình luận
            </div>
            <CommentSection movieId={id} />
          </div>

        </div>
      </section>
    </main>
  );
}