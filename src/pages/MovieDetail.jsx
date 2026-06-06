import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGetPhimDetail, apiGetTrailer } from "../api/api"; 
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import TrailerModal from "../components/TrailerModal";

export default function MovieDetail() {
  const { showToast } = useNotification();
  const { id } = useParams();
  const navigate = useNavigate();
  const [movieDetails, setMovieDetails] = useState(null);
  const [movieServers, setMovieServers] = useState([]); 
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [loading, setLoading] = useState(true);

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
    <main className="pb-20 bg-black min-h-screen text-white">
      <TrailerModal isOpen={isTrailerOpen} onClose={() => setIsTrailerOpen(false)} youtubeKey={trailerKey} />
      
      {/* 👇 ĐÃ THÊM overflow-hidden Ở ĐÂY ĐỂ FIX LỖI TRÀN MÀN HÌNH ĐIỆN THOẠI 👇 */}
      <section className="relative w-full h-[45vh] md:h-[55vh] overflow-hidden">
        <img className="w-full h-full object-cover opacity-30 scale-105" src={getFullImageUrl(movieDetails.poster_url)} alt={movieDetails.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 flex items-end px-4 md:px-12 pb-12">
          <div className="space-y-4 max-w-4xl">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter drop-shadow-2xl">{movieDetails.name}</h1>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <span className="bg-white text-black px-3 py-1 rounded-md text-xs font-black">{movieDetails.year}</span>
              <span className="bg-primary px-3 py-1 rounded-md text-xs font-black uppercase">{movieDetails.quality}</span>
              <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-md text-xs font-bold">{movieDetails.lang}</span>
            </div>
            
            {/* NÚT XEM TRAILER & LƯU PHIM */}
            <div className="flex flex-wrap gap-4 pt-2">
              <button 
                onClick={handleWatchTrailer}
                disabled={isTrailerLoading}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all backdrop-blur-md shadow-lg"
              >
                <span className={`material-symbols-outlined text-[20px] ${isTrailerLoading ? "animate-spin" : ""}`}>
                  {isTrailerLoading ? "progress_activity" : "smart_display"}
                </span>
                {isTrailerLoading ? "Đang tìm..." : "Xem Trailer"}
              </button>

              <button 
                onClick={() => isSaved(movieDetails.slug) ? removeFromWatchlist(movieDetails.slug) : addToWatchlist({
                  slug: movieDetails.slug,
                  name: movieDetails.name,
                  thumb_url: getFullImageUrl(movieDetails.thumb_url),
                  year: movieDetails.year
                })}
                className={`px-5 py-2.5 border rounded-xl font-bold text-sm flex items-center gap-2 transition-all backdrop-blur-md shadow-lg ${
                  isSaved(movieDetails.slug) 
                    ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30" 
                    : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isSaved(movieDetails.slug) ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                {isSaved(movieDetails.slug) ? "Đã Lưu" : "Lưu Phim"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 md:px-12 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <div className="sticky top-28">
            <img src={getFullImageUrl(movieDetails.thumb_url)} className="w-full rounded-2xl border border-white/5 shadow-2xl" alt="Poster" />
          </div>
        </div>

        <div className="md:col-span-3 space-y-12">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold border-l-4 border-primary pl-4 uppercase tracking-wider">Nội dung phim</h2>
              <div className="text-zinc-400 leading-relaxed text-lg italic bg-zinc-900/30 p-6 rounded-2xl border border-white/5" dangerouslySetInnerHTML={{ __html: movieDetails.content || "Chưa có nội dung mô tả." }} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12 text-sm bg-zinc-900/20 p-8 rounded-2xl border border-white/5">
              <div className="flex flex-col gap-1"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Đạo diễn</span><span className="text-zinc-200 text-base">{Array.isArray(movieDetails.director) ? movieDetails.director.join(", ") : "Đang cập nhật"}</span></div>
              <div className="flex flex-col gap-1"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Năm phát hành</span><span className="text-zinc-200 text-base">{movieDetails.year}</span></div>
              <div className="flex flex-col gap-1 md:col-span-2"><span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Diễn viên</span><span className="text-zinc-200 text-base leading-relaxed">{Array.isArray(movieDetails.actor) ? movieDetails.actor.join(", ") : "Đang cập nhật"}</span></div>
            </div>
          </div>

          <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-inner">
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
              <span className="material-symbols-outlined text-primary">playlist_play</span>
              <h3 className="text-xl font-bold uppercase tracking-tight">Chọn tập phim</h3>
            </div>
            
            {movieServers.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-black/50 rounded-xl w-fit border border-white/5">
                {movieServers.map((server, index) => (
                  <button key={index} onClick={() => setSelectedServerIndex(index)}
                    className={`px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${selectedServerIndex === index ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                  >
                    {server.server_name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {currentEpisodes.map((ep) => (
                <button key={ep.slug}
                  onClick={() => {
                    navigate(`/play/${movieDetails.slug}`, { 
                      state: { 
                        // MAPPING CHUẨN XÁC BAO THẦU CẢ KKPHIM VÀ NGUONC
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
                  className="min-w-[65px] h-12 px-4 flex items-center justify-center bg-zinc-800 hover:bg-primary text-white rounded-xl font-bold transition-all duration-300 border border-white/5"
                >
                  {ep.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}