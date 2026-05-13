import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js"; 
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const { user } = useAuth();
  
  // 👇 FIX 1: Hứng thêm biến cloudProgress từ trang Home/Profile truyền sang
  const { videoUrl, embedFallback, movieName, epName, allServers, currentServerIndex, posterUrl, cloudProgress } = location.state || {};

  // --- CÁC REF VÀ STATE CỦA CUSTOM PLAYER ---
  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [activeServerIdx, setActiveServerIdx] = useState(currentServerIndex || 0);
  const [currentVideo, setCurrentVideo] = useState(videoUrl);
  const [currentEmbed, setCurrentEmbed] = useState(embedFallback);
  const [currentEpName, setCurrentEpName] = useState(epName);
  
  const [useIframe, setUseIframe] = useState(false);
  
  // State điều khiển Video
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Bắt lỗi F5
  useEffect(() => {
    if (!videoUrl && !embedFallback) {
      navigate(`/movie/${id}`, { replace: true });
    }
  }, [videoUrl, embedFallback, id, navigate]);

  const rawEpisodes = allServers?.[activeServerIdx]?.server_data || allServers?.[activeServerIdx]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  // 1. LƯU TIẾN ĐỘ THÔNG MINH XUỐNG FIREBASE
  const saveToFirebase = async () => {
    if (!user || !movieName) return;
    try {
      const historyRef = doc(db, "users", user.uid, "watchHistory", id);
      await setDoc(historyRef, {
        slug: id, movieId: id, title: movieName, epName: currentEpName,
        // 👇 Dùng trực tiếp thời gian thực của video để lưu chuẩn nhất
        image: posterUrl, progress: videoRef.current?.currentTime || currentTime, lastWatched: serverTimestamp() 
      });
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    saveToFirebase();
  }, [currentVideo, useIframe]);

  // 2. KHỞI TẠO ĐỘNG CƠ HLS & CLOUD SYNC
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useIframe || !currentVideo) return;

    let hls;
    const safeVideoUrl = currentVideo.replace("http://", "https://");
    
    // 👇 FIX 2: Ưu tiên lấy progress từ Đám Mây (Firebase), nếu không có mới tìm trong Máy Tính (Local)
    const localTime = localStorage.getItem(`progress_${id}_${currentEpName}`);
    const savedTime = cloudProgress || localTime;

    if (Hls.isSupported()) {
      hls = new Hls({ debug: false, enableWorker: true });
      hls.loadSource(safeVideoUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (savedTime) video.currentTime = parseFloat(savedTime);
      });
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.warn("⚠️ HLS tịt ngòi, tự động bật Iframe!");
          setUseIframe(true);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = safeVideoUrl;
      video.addEventListener("loadedmetadata", () => {
        if (savedTime) video.currentTime = parseFloat(savedTime);
      });
      video.addEventListener("error", () => setUseIframe(true));
    }

    return () => { if (hls) hls.destroy(); };
  }, [currentVideo, useIframe, currentEpName, id, cloudProgress]);

  // 3. CÁC HÀM ĐIỀU KHIỂN CUSTOM PLAYER
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleSkip = (amount) => {
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);
      localStorage.setItem(`progress_${id}_${currentEpName}`, current);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
    return `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
  };

  // Ẩn/Hiện Controls thông minh
  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Bắt sự kiện bàn phím (Space, Mũi tên)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (useIframe) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') handleSkip(10);
      if (e.code === 'ArrowLeft') handleSkip(-10);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, useIframe]);


  // 4. LOGIC ĐỔI TẬP VÀ SERVER
  const handleSwitchEpisode = (ep) => {
    saveToFirebase();
    setCurrentVideo(ep.link_m3u8 || ep.m3u8 || ""); 
    setCurrentEmbed(ep.link_embed || ep.embed || "");
    setCurrentEpName(ep.name);
    setUseIframe(false);
  };

  const handleSwitchServer = (idx) => {
    setActiveServerIdx(idx);
    const newServerEpisodes = allServers[idx].server_data || allServers[idx].items || [];
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    handleSwitchEpisode(equivalentEp);
  };

  const currentIndex = currentEpisodes.findIndex(e => e.name === currentEpName);
  const nextEpisode = currentIndex < currentEpisodes.length - 1 ? currentEpisodes[currentIndex + 1] : null;

  const renderEpisodeName = (name) => {
    if (!name) return "";
    return `Tập ${name.replace(/tập/gi, "").trim()}`;
  };

  if (!currentVideo && !currentEmbed) return null; 
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen bg-black text-white pt-24 pb-20 font-sans overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={posterUrl} alt="Bg" className="w-full h-full object-cover opacity-20 blur-[100px] scale-150" />
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-4">
        
        {/* --- KHUNG PHÁT VIDEO CUSTOM --- */}
        <div 
          ref={playerWrapperRef}
          className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 group flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {useIframe ? (
            <iframe src={currentEmbed} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <>
              {/* Thẻ Video Gốc Bị Giấu Thanh Điều Khiển */}
              <video
                ref={videoRef}
                playsInline
                poster={posterUrl}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Nút Play Khổng Lồ Ở Giữa Khi Tạm Dừng */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40 transition-all">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(var(--primary-rgb),0.8)] backdrop-blur-md animate-pulse">
                    <span className="material-symbols-outlined text-6xl ml-2">play_arrow</span>
                  </div>
                </div>
              )}

              {/* THANH ĐIỀU KHIỂN (CONTROLS BAR) OVERLAY */}
              <div className={`absolute bottom-0 left-0 right-0 px-4 md:px-8 pt-20 pb-6 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                
                {/* Thanh Tua Thời Gian (Progress Bar) */}
                <div className="w-full h-1.5 md:h-2 bg-white/30 rounded-full cursor-pointer relative group/progress mb-4 md:mb-6" onClick={handleProgressClick}>
                  <div className="h-full bg-primary rounded-full relative" style={{ width: `${progressPercent}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform"></div>
                  </div>
                </div>

                {/* Hàng Nút Bấm */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 md:gap-6">
                    {/* Play/Pause */}
                    <button onClick={togglePlay} className="text-white hover:text-primary transition-colors focus:outline-none">
                      <span className="material-symbols-outlined text-4xl md:text-5xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>

                    {/* Tua Lùi / Tua Tới 10s */}
                    <button onClick={() => handleSkip(-10)} className="text-white hover:text-primary transition-colors focus:outline-none hidden sm:block">
                      <span className="material-symbols-outlined text-3xl md:text-4xl">replay_10</span>
                    </button>
                    <button onClick={() => handleSkip(10)} className="text-white hover:text-primary transition-colors focus:outline-none hidden sm:block">
                      <span className="material-symbols-outlined text-3xl md:text-4xl">forward_10</span>
                    </button>

                    {/* Điều chỉnh âm lượng */}
                    <div className="flex items-center gap-2 group/volume relative hidden md:flex">
                      <button onClick={toggleMute} className="text-white hover:text-primary transition-colors focus:outline-none">
                        <span className="material-symbols-outlined text-3xl">{isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}</span>
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 accent-primary cursor-pointer h-1.5 bg-white/30 rounded-full appearance-none"
                      />
                    </div>

                    {/* Hiển thị thời gian */}
                    <span className="text-sm md:text-base font-medium text-white/80">
                      {formatTime(currentTime)} <span className="mx-1 text-white/40">/</span> {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 md:gap-6">
                    {/* Phóng to toàn màn hình */}
                    <button onClick={toggleFullscreen} className="text-white hover:text-primary transition-colors focus:outline-none">
                      <span className="material-symbols-outlined text-3xl md:text-4xl">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* --- THÔNG TIN PHIM VÀ CHUYỂN SERVER --- */}
        <div className="mt-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-white/10">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter drop-shadow-md">{movieName}</h1>
            
            <div className="flex gap-3 items-center flex-wrap">
               <span className="bg-primary/20 text-primary px-4 py-2 rounded-xl border border-primary/30 text-sm font-black uppercase tracking-widest">
                {renderEpisodeName(currentEpName)}
              </span>
              
              {/* NÚT CHUYỂN SERVER THÔNG MINH */}
              <button 
                onClick={() => setUseIframe(!useIframe)} 
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {useIframe ? "dns" : "public"}
                </span>
                {useIframe ? "Quay lại Server Chính (M3U8)" : "Bật Server Dự Phòng (Embed)"}
              </button>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto mt-4 md:mt-0">
            <button onClick={() => navigate(-1)} className="flex-1 md:flex-none px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black transition-all">QUAY LẠI</button>
            {nextEpisode && (
              <button onClick={() => handleSwitchEpisode(nextEpisode)} className="flex-1 md:flex-none px-8 py-4 bg-primary hover:bg-primary-fixed rounded-2xl font-black text-white transition-all shadow-lg">TẬP TIẾP THEO</button>
            )}
          </div>
        </div>

        {/* --- DANH SÁCH TẬP KHÁC --- */}
        <div className="mt-12">
          <h3 className="text-2xl font-black uppercase mb-6 tracking-tighter">Chọn tập khác</h3>
          {allServers?.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-zinc-900/50 rounded-xl w-fit border border-white/5">
              {allServers.map((server, index) => (
                <button key={index} onClick={() => handleSwitchServer(index)}
                  className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${activeServerIdx === index ? "bg-primary text-white shadow-md" : "text-zinc-400 hover:text-white"}`}
                >
                  {server.server_name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            {currentEpisodes.map((ep) => (
              <button key={ep.slug} onClick={() => handleSwitchEpisode(ep)}
                className={`min-w-[75px] h-14 px-5 flex items-center justify-center rounded-2xl font-black transition-all border-2 ${
                  ep.name === currentEpName ? "bg-primary border-primary text-white scale-110 shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] z-10" : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/20"
                }`}
              >
                {ep.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}