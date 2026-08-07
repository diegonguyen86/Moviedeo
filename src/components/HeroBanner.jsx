import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { apiGetMovieLogo, apiGetPhimDetail } from "../api/api";
import Hls from "hls.js";

export default function HeroBanner({ movies = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  // Lấy media khi đổi phim
  useEffect(() => {
    if (!movies || movies.length === 0) return;
    
    let isMounted = true;
    const movie = movies[currentIndex];
    
    setVideoUrl(null);
    setLogoUrl(null);
    setIsPlaying(false);

    const fetchMedia = async () => {
      try {
        const [detailRes, logo] = await Promise.all([
          apiGetPhimDetail(movie.id || movie.slug),
          apiGetMovieLogo(movie.origin_name || movie.title || movie.name)
        ]);
        
        if (isMounted) {
          const m3u8Link = detailRes?.episodes?.[0]?.server_data?.[0]?.link_m3u8;
          if (m3u8Link) setVideoUrl(m3u8Link.replace("http://", "https://"));
          if (logo) setLogoUrl(logo);
        }
      } catch (err) {}
    };
    fetchMedia();

    return () => { isMounted = false; };
  }, [currentIndex, movies]);

  // Thiết lập HLS cho Video
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls;

    const startPlaying = () => {
      video.play().catch(() => {});
    };

    if (Hls.isSupported()) {
      hls = new Hls({ debug: false, startPosition: 120 });
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlaying);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Dành cho Safari
      video.src = videoUrl;
      video.currentTime = 120;
      video.addEventListener("loadedmetadata", startPlaying);
    }

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener("loadedmetadata", startPlaying);
    };
  }, [videoUrl]);

  // Tự động chuyển slide sau mỗi 25 giây
  useEffect(() => {
    if (!movies || movies.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % movies.length);
    }, 25000);

    return () => clearInterval(interval);
  }, [movies.length]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime >= 140) {
      video.currentTime = 120;
    }
  };

  if (!movies || movies.length === 0) return null;
  const currentMovie = movies[currentIndex];

  return (
    <section className="relative w-full h-[70vh] md:h-[85vh] lg:h-[95vh] flex items-end overflow-hidden group">
      <div className="absolute inset-0 z-0 bg-black">
        
        <img
          alt={currentMovie.title}
          className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-1000 ${isPlaying ? 'opacity-0' : 'opacity-50'}`}
          src={currentMovie.image}
        />
        
        {videoUrl && (
          <div className={`absolute inset-0 w-full h-full scale-[1.35] md:scale-[1.15] pointer-events-none transition-opacity duration-1000 ${isPlaying ? 'opacity-50' : 'opacity-0'}`}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPlaying={() => setIsPlaying(true)}
              onWaiting={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        )}

        {/* Lớp phủ Gradient tạo chiều sâu điện ảnh */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/90 via-[#0A0A0A]/50 to-transparent"></div>
      </div>
      
      <div className="relative z-10 px-6 md:px-12 pb-16 md:pb-24 w-full max-w-container-max mx-auto">
        <div className="space-y-6 max-w-2xl">
          
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-1.5 rounded-[4px] font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              Top {currentIndex + 1} Trending
            </span>
          </div>
          
          {logoUrl ? (
            <div className="space-y-2">
              <img src={logoUrl} alt={currentMovie.title || currentMovie.name} className="w-full max-w-[400px] max-h-[150px] object-contain object-left drop-shadow-2xl" />
              <h3 className="text-pink-500 font-bold text-sm tracking-widest uppercase">{currentMovie.title || currentMovie.name}</h3>
            </div>
          ) : (
            <h2 className="text-4xl md:text-6xl leading-tight font-black text-white tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
              {currentMovie.title || currentMovie.name}
            </h2>
          )}
          
          <p className="text-zinc-300 font-medium text-sm md:text-base line-clamp-3 leading-relaxed drop-shadow-md max-w-xl">
            {currentMovie.description || "Một siêu phẩm điện ảnh đang làm mưa làm gió trên các bảng xếp hạng. Khám phá ngay!"}
          </p>
          
          <div className="flex items-center gap-4 pt-4">
            <Link to={`/movie/${currentMovie.id}`} className="group flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-8 py-3.5 rounded-full font-black text-sm hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              <span className="material-symbols-outlined filled text-[28px]">play_circle</span>
              XEM NGAY
            </Link>
            
            <Link to={`/movie/${currentMovie.id}`} className="group flex items-center gap-2 bg-white/10 text-white px-8 py-3.5 rounded-full font-bold text-sm border border-white/20 hover:bg-white/20 transition-all duration-300 backdrop-blur-md hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              <span className="material-symbols-outlined text-[28px]">info</span>
              CHI TIẾT
            </Link>
          </div>
        </div>
      </div>

      {/* CHUYỂN SLIDE (THUMBNAILS) */}
      <div className="absolute bottom-6 right-6 md:right-12 z-20 flex gap-3 hidden md:flex">
        {movies.map((m, i) => (
          <button 
            key={i} 
            onClick={() => setCurrentIndex(i)}
            className={`w-32 aspect-video rounded-lg overflow-hidden border-2 transition-all duration-500 ${i === currentIndex ? 'border-yellow-500 scale-110 shadow-[0_0_20px_rgba(234,179,8,0.6)] z-10' : 'border-white/20 hover:border-white/50 opacity-60 hover:opacity-100'}`}
          >
            <img src={m.image} alt={m.title} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}