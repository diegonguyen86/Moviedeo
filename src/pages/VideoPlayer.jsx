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
  
  const { videoUrl, embedFallback, movieName, epName, allServers, currentServerIndex, posterUrl, cloudProgress } = location.state || {};

  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);

  const [activeServerIdx, setActiveServerIdx] = useState(currentServerIndex || 0);
  const [currentVideo, setCurrentVideo] = useState(videoUrl);
  const [currentEmbed, setCurrentEmbed] = useState(embedFallback);
  const [currentEpName, setCurrentEpName] = useState(epName);
  
  const [useIframe, setUseIframe] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // STATE MỚI: Panel chọn tập phim Netflix
  const [showEpisodes, setShowEpisodes] = useState(false);

  useEffect(() => {
    if (!videoUrl && !embedFallback) navigate(`/movie/${id}`, { replace: true });
  }, [videoUrl, embedFallback, id, navigate]);

  const rawEpisodes = allServers?.[activeServerIdx]?.server_data || allServers?.[activeServerIdx]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  const saveToFirebase = async () => {
    if (!user || !movieName) return;
    try {
      const historyRef = doc(db, "users", user.uid, "watchHistory", id);
      await setDoc(historyRef, {
        slug: id, movieId: id, title: movieName, epName: currentEpName,
        image: posterUrl, progress: videoRef.current?.currentTime || currentTime, lastWatched: serverTimestamp() 
      });
    } catch (error) {}
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    saveToFirebase();
  }, [currentVideo, useIframe]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || useIframe || !currentVideo) return;

    let hls;
    const safeVideoUrl = currentVideo.replace("http://", "https://");
    const localTime = localStorage.getItem(`progress_${id}_${currentEpName}`);
    const savedTime = cloudProgress || localTime;

    if (Hls.isSupported()) {
      hls = new Hls({ debug: false, enableWorker: true });
      hls.loadSource(safeVideoUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (savedTime) video.currentTime = parseFloat(savedTime);
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) setUseIframe(true);
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

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleSkip = (amount) => {
    if (videoRef.current) videoRef.current.currentTime += amount;
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

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setShowSettings(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handlePointerUpdate = (e) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos)); 
    videoRef.current.currentTime = pos * duration;
  };

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerUpdate(e);
  };

  const handlePointerMove = (e) => {
    if (e.buttons === 1) handlePointerUpdate(e); 
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      localStorage.setItem(`progress_${id}_${currentEpName}`, videoRef.current.currentTime);
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

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      // Giữ controls không bị ẩn nếu đang mở Setting hoặc Panel Tập
      if (isPlaying && !showSettings && !showEpisodes) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (useIframe) return;
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'k') { e.preventDefault(); togglePlay(); }
      if (key === 'f') toggleFullscreen();
      if (key === 'm') toggleMute();
      if (key === 'j' || e.code === 'ArrowLeft') handleSkip(-10);
      if (key === 'l' || e.code === 'ArrowRight') handleSkip(10);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, useIframe]);

  const handleSwitchEpisode = (ep) => {
    saveToFirebase();
    setCurrentVideo(ep.link_m3u8 || ep.m3u8 || ""); 
    setCurrentEmbed(ep.link_embed || ep.embed || "");
    setCurrentEpName(ep.name);
    setUseIframe(false);
    setShowEpisodes(false); // Đóng panel sau khi chọn tập
  };

  const handleSwitchServer = (idx) => {
    setActiveServerIdx(idx);
    const newServerEpisodes = allServers[idx].server_data || allServers[idx].items || [];
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    handleSwitchEpisode(equivalentEp);
  };

  const renderEpisodeName = (name) => {
    if (!name) return "";
    return `Tập ${name.replace(/tập/gi, "").trim()}`;
  };

  if (!currentVideo && !currentEmbed) return null; 
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen bg-[#050505] text-white pt-8 md:pt-12 pb-20 font-sans overflow-hidden select-none">
      
      {/* AMBIENT ÁNH SÁNG TRÀN TOÀN BỘ TRANG WEB */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-[100px] scale-110 saturate-150 transition-all duration-1000" 
          style={{ backgroundImage: `url(${posterUrl})` }}
        ></div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* KHU VỰC BREADCRUMB NỔI (GLASSMORPHISM TRẮNG) */}
      <div className="relative z-20 max-w-[1260px] mx-auto px-4 mb-6 flex items-center justify-between">
        <button 
          onClick={() => { saveToFirebase(); navigate(-1); }} 
          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-black transition-all text-xs tracking-widest backdrop-blur-xl shadow-[0_0_15px_rgba(255,255,255,0.05)] text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          QUAY LẠI
        </button>
        <div className="hidden md:flex flex-col items-end drop-shadow-2xl">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white">{movieName}</h2>
          <span className="text-white font-bold text-sm tracking-widest bg-white/10 border border-white/10 px-3 py-1 rounded-md backdrop-blur-md mt-1">{renderEpisodeName(currentEpName)}</span>
        </div>
      </div>

      {/* --- KHUNG PHÁT VIDEO CHÍNH --- */}
      <div className="relative z-10 max-w-[1260px] mx-auto px-4">
        
        <div 
          ref={playerWrapperRef}
          className="relative w-full aspect-video bg-black/90 rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] border border-white/10 group flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { if (isPlaying && !showEpisodes) setShowControls(false); setShowSettings(false); }}
        >
          {useIframe ? (
            <iframe src={currentEmbed} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <>
              {/* VIDEO CORE */}
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

              {/* NÚT PLAY KHỔNG LỒ GIỮA MÀN HÌNH (WHITE GLASS GLOW) */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 transition-all">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white/10 border border-white/30 text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] backdrop-blur-xl animate-pulse">
                    <span className="material-symbols-outlined text-6xl ml-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">play_arrow</span>
                  </div>
                </div>
              )}

              {/* NETFLIX STYLE: PANEL CHỌN TẬP BÊN TRONG VIDEO (GLASS TRẮNG ĐEN) */}
              <div className={`absolute top-0 right-0 bottom-0 w-full sm:w-[350px] bg-black/70 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col transition-transform duration-300 ease-in-out ${showEpisodes ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 flex justify-between items-center border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
                  <h3 className="text-white font-black text-xl tracking-tighter uppercase drop-shadow-md">Danh sách tập</h3>
                  <button onClick={() => setShowEpisodes(false)} className="text-zinc-400 hover:text-white transition-colors hover:rotate-90 transform duration-300">
                    <span className="material-symbols-outlined text-3xl">close</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/40">
                  {currentEpisodes.map((ep) => (
                    <button 
                      key={ep.slug} 
                      onClick={() => handleSwitchEpisode(ep)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-bold text-sm transition-all duration-300 border ${
                        ep.name === currentEpName 
                          ? "bg-white/20 border-white/40 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]" 
                          : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white hover:scale-[1.02]"
                      }`}
                    >
                      <span>{renderEpisodeName(ep.name)}</span>
                      {ep.name === currentEpName && <span className="material-symbols-outlined text-[20px] animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">play_circle</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* BẢNG ĐIỀU KHIỂN LƠ LỬNG KÍNH MỜ */}
              <div className={`absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 px-6 pt-5 pb-5 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] transition-all duration-300 z-30 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                
                {/* THANH TUA PROGRESS BAR MÀU TRẮNG PHÁT SÁNG */}
                <div 
                  ref={progressBarRef}
                  className="w-full h-2 md:h-2 bg-white/20 rounded-full cursor-pointer relative group/progress mb-5 flex items-center" 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                >
                  <div className="absolute -inset-y-4 inset-x-0 bg-transparent z-10"></div> 
                  <div className="h-full bg-white rounded-full relative pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${progressPercent}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)] scale-0 group-hover/progress:scale-100 transition-transform"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 md:gap-6">
                    <button onClick={togglePlay} className="text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-4xl md:text-[40px]">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
                    </button>

                    <button onClick={() => handleSkip(-10)} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl">replay_10</span>
                    </button>
                    <button onClick={() => handleSkip(10)} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl">forward_10</span>
                    </button>

                    <div className="flex items-center gap-2 group/volume relative hidden md:flex ml-2">
                      <button onClick={toggleMute} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none">
                        <span className="material-symbols-outlined text-[28px]">{isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}</span>
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 accent-white cursor-pointer h-1.5 bg-white/30 rounded-full appearance-none"
                      />
                    </div>

                    <div className="h-5 w-px bg-white/20 hidden md:block mx-2"></div>

                    <span className="text-sm md:text-[14px] font-semibold text-white/90 tracking-wide">
                      {formatTime(currentTime)} <span className="mx-1 text-white/40">/</span> {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 md:gap-5 relative">
                    
                    {/* NÚT MỞ PANEL CHỌN TẬP */}
                    <button onClick={() => { setShowEpisodes(!showEpisodes); setShowSettings(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200 ${showEpisodes ? 'drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Danh sách tập">
                      <span className="material-symbols-outlined text-3xl md:text-[32px]">video_library</span>
                    </button>

                    <div className="relative">
                      <button onClick={() => { setShowSettings(!showSettings); setShowEpisodes(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:rotate-90 transform duration-300 ${showSettings ? 'rotate-90 drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Cài đặt">
                        <span className="material-symbols-outlined text-3xl md:text-[32px]">settings</span>
                      </button>
                      
                      {showSettings && (
                        <div className="absolute bottom-full right-0 mb-4 w-36 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 py-2 origin-bottom transition-all">
                          <span className="px-4 py-2 text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-1">Tốc độ phát</span>
                          {[0.5, 1, 1.5, 2].map((rate) => (
                            <button 
                              key={rate} 
                              onClick={() => changeSpeed(rate)}
                              className={`px-4 py-2 text-sm font-bold text-left transition-colors flex items-center justify-between ${playbackRate === rate ? 'text-white bg-white/20' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}`}
                            >
                              {rate === 1 ? 'Chuẩn' : `${rate}x`}
                              {playbackRate === rate && <span className="material-symbols-outlined text-[16px] drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">check</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={toggleFullscreen} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl md:text-[36px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* THANH CONTROL CENTER BÊN DƯỚI DÀNH CHO VIỆC CHUYỂN SERVER */}
        <div className="mt-6 md:mt-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 border border-white/10 rounded-[1.5rem] p-4 md:p-6 backdrop-blur-2xl shadow-2xl relative z-10">
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <span className="material-symbols-outlined text-white text-2xl animate-pulse">router</span>
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-widest text-sm drop-shadow-md">Kết nối máy chủ</h3>
              <p className="text-zinc-400 text-xs mt-0.5">Chuyển đổi khi gặp sự cố giật lag</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {allServers?.length > 1 && (
              <select 
                className="w-full md:w-auto bg-black/60 border border-white/20 text-white text-sm font-bold rounded-xl px-5 py-3 outline-none focus:border-white transition-colors appearance-none cursor-pointer backdrop-blur-md"
                value={activeServerIdx}
                onChange={(e) => handleSwitchServer(Number(e.target.value))}
              >
                {allServers.map((server, index) => (
                  <option key={index} value={index}>{server.server_name}</option>
                ))}
              </select>
            )}

            <button 
              onClick={() => setUseIframe(!useIframe)} 
              className={`w-full md:w-auto px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border shadow-lg backdrop-blur-md ${useIframe ? 'bg-white/20 border-white/40 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'bg-black/40 border-white/20 text-zinc-300 hover:text-white hover:bg-white/10'}`}
            >
              <span className="material-symbols-outlined text-[20px]">{useIframe ? "public" : "dns"}</span>
              {useIframe ? "Dự Phòng (Đổi sang M3U8)" : "Chính: M3U8 (Đổi sang Dự Phòng)"}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}