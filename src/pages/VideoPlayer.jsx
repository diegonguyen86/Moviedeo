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
      if (isPlaying && !showSettings) setShowControls(false);
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
    <main className="relative min-h-screen bg-[#050505] text-white pt-8 md:pt-12 pb-20 font-sans overflow-hidden select-none">
      
      {/* 👇 FIX 1: AMBIENT ÁNH SÁNG TRÀN TOÀN BỘ TRANG WEB */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-[100px] scale-110 saturate-150 transition-all duration-1000" 
          style={{ backgroundImage: `url(${posterUrl})` }}
        ></div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* KHU VỰC BREADCRUMB NỔI (GLASSMORPHISM) */}
      <div className="relative z-20 max-w-[1260px] mx-auto px-4 mb-6 flex items-center justify-between">
        <button 
          onClick={() => { saveToFirebase(); navigate(-1); }} 
          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-black transition-all text-xs tracking-widest backdrop-blur-xl shadow-lg"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          QUAY LẠI
        </button>
        <div className="hidden md:flex flex-col items-end drop-shadow-2xl">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white">{movieName}</h2>
          <span className="text-primary font-bold text-sm tracking-widest bg-black/40 px-3 py-1 rounded-md backdrop-blur-md mt-1">{renderEpisodeName(currentEpName)}</span>
        </div>
      </div>

      {/* --- KHUNG PHÁT VIDEO CHÍNH --- */}
      <div className="relative z-10 max-w-[1260px] mx-auto px-4">
        
        <div 
          ref={playerWrapperRef}
          className="relative w-full aspect-video bg-black/90 rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] border border-white/10 group flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { if (isPlaying) setShowControls(false); setShowSettings(false); }}
        >
          {useIframe ? (
            <iframe src={currentEmbed} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <>
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

              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30 transition-all">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-primary/90 text-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(var(--primary-rgb),0.6)] backdrop-blur-xl animate-pulse">
                    <span className="material-symbols-outlined text-6xl ml-2">play_arrow</span>
                  </div>
                </div>
              )}

              {/* 👇 FIX 2: BẢNG ĐIỀU KHIỂN LƠ LỬNG KÍNH MỜ (FLOATING GLASS CONTROLS) */}
              <div className={`absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 px-6 pt-5 pb-5 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] transition-all duration-300 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                
                <div 
                  ref={progressBarRef}
                  className="w-full h-2 md:h-2 bg-white/20 rounded-full cursor-pointer relative group/progress mb-5 flex items-center" 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                >
                  <div className="absolute -inset-y-4 inset-x-0 bg-transparent z-10"></div> 
                  <div className="h-full bg-primary rounded-full relative pointer-events-none shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]" style={{ width: `${progressPercent}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 md:gap-6">
                    <button onClick={togglePlay} className="text-white hover:text-primary transition-colors focus:outline-none hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-4xl md:text-[40px]">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
                    </button>

                    <button onClick={() => handleSkip(-10)} className="text-white hover:text-primary transition-colors focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl">replay_10</span>
                    </button>
                    <button onClick={() => handleSkip(10)} className="text-white hover:text-primary transition-colors focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl">forward_10</span>
                    </button>

                    <div className="flex items-center gap-2 group/volume relative hidden md:flex ml-2">
                      <button onClick={toggleMute} className="text-white hover:text-primary transition-colors focus:outline-none">
                        <span className="material-symbols-outlined text-[28px]">{isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}</span>
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 accent-primary cursor-pointer h-1.5 bg-white/30 rounded-full appearance-none"
                      />
                    </div>

                    <div className="h-5 w-px bg-white/20 hidden md:block mx-2"></div>

                    <span className="text-sm md:text-[14px] font-semibold text-white/90 tracking-wide">
                      {formatTime(currentTime)} <span className="mx-1 text-white/40">/</span> {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 md:gap-6 relative">
                    <div className="relative">
                      <button onClick={() => setShowSettings(!showSettings)} className={`text-white hover:text-primary transition-colors focus:outline-none hover:rotate-90 transform duration-300 ${showSettings ? 'text-primary rotate-90' : ''}`}>
                        <span className="material-symbols-outlined text-3xl">settings</span>
                      </button>
                      
                      {showSettings && (
                        <div className="absolute bottom-full right-0 mb-4 w-36 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 py-2 origin-bottom transition-all">
                          <span className="px-4 py-2 text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-1">Tốc độ phát</span>
                          {[0.5, 1, 1.5, 2].map((rate) => (
                            <button 
                              key={rate} 
                              onClick={() => changeSpeed(rate)}
                              className={`px-4 py-2 text-sm font-bold text-left transition-colors flex items-center justify-between ${playbackRate === rate ? 'text-primary bg-white/10' : 'text-zinc-200 hover:bg-white/10 hover:text-white'}`}
                            >
                              {rate === 1 ? 'Chuẩn' : `${rate}x`}
                              {playbackRate === rate && <span className="material-symbols-outlined text-[16px]">check</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={toggleFullscreen} className="text-white hover:text-primary transition-colors focus:outline-none hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl md:text-[34px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 👇 FIX 3: KHUNG CHỌN TẬP BẰNG KÍNH MỜ CỰC ĐẸP */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-10 backdrop-blur-2xl shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 drop-shadow-md">
              <span className="material-symbols-outlined text-primary text-3xl drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]">video_library</span>
              Danh sách tập
            </h3>
            
            <button 
              onClick={() => setUseIframe(!useIframe)} 
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border shadow-lg ${useIframe ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'bg-black/40 border-white/10 text-zinc-300 hover:text-white hover:bg-black/60'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{useIframe ? "public" : "dns"}</span>
              {useIframe ? "Đang dùng: Embed (Bấm về M3U8)" : "Đang dùng: M3U8 (Bấm qua Embed)"}
            </button>
          </div>

          {allServers?.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-8 p-1.5 bg-black/30 rounded-xl w-fit border border-white/5">
              {allServers.map((server, index) => (
                <button key={index} onClick={() => handleSwitchServer(index)}
                  className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeServerIdx === index ? "bg-white/20 text-white shadow-md backdrop-blur-md" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
                >
                  {server.server_name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            {currentEpisodes.map((ep) => (
              <button key={ep.slug} onClick={() => handleSwitchEpisode(ep)}
                className={`min-w-[80px] h-14 px-6 flex items-center justify-center rounded-2xl font-black transition-all border-2 ${
                  ep.name === currentEpName ? "bg-primary border-primary text-white scale-110 shadow-[0_10px_20px_rgba(var(--primary-rgb),0.4)] z-10" : "bg-black/40 border-white/10 text-zinc-300 hover:text-white hover:border-white/30 hover:bg-white/5"
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