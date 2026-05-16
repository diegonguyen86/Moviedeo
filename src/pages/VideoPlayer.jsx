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
  
  // 👇 FIX 1: Thêm state quản lý tiến trình Firebase (Trị Zombie Progress)
  const [activeCloudProgress, setActiveCloudProgress] = useState(cloudProgress);

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
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false); 

  // STATE: AUTO-NEXT
  const [isAutoNexting, setIsAutoNexting] = useState(false);
  const [autoNextCounter, setAutoNextCounter] = useState(5);

  const rawEpisodes = allServers?.[activeServerIdx]?.server_data || allServers?.[activeServerIdx]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  // TÌM TẬP TIẾP THEO
  const currentIndex = currentEpisodes.findIndex(e => e.name === currentEpName);
  const nextEpisode = currentIndex !== -1 && currentIndex < currentEpisodes.length - 1 ? currentEpisodes[currentIndex + 1] : null;

  useEffect(() => {
    if (!videoUrl && !embedFallback) navigate(`/movie/${id}`, { replace: true });
  }, [videoUrl, embedFallback, id, navigate]);

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
    
    // 👇 FIX 1: Dùng activeCloudProgress thay vì cloudProgress
    const savedTime = activeCloudProgress || localTime;

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
  }, [currentVideo, useIframe, currentEpName, id, activeCloudProgress]); // Đổi dependency

  // ĐẾM NGƯỢC AUTO-NEXT
  useEffect(() => {
    let timer;
    if (isAutoNexting && autoNextCounter > 0) {
      timer = setTimeout(() => setAutoNextCounter(c => c - 1), 1000);
    } else if (isAutoNexting && autoNextCounter === 0) {
      handleSwitchEpisode(nextEpisode);
    }
    return () => clearTimeout(timer);
  }, [isAutoNexting, autoNextCounter, nextEpisode]);

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

  const toggleFullscreen = async () => {
    const elem = playerWrapperRef.current;
    const video = videoRef.current;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) { 
        await elem.webkitRequestFullscreen();
      } else if (video && video.webkitEnterFullscreen) { 
        video.webkitEnterFullscreen();
      }
      
      try {
        if (window.screen && screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch (error) {}
      
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }

      try {
        if (window.screen && screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (error) {}

      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

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

  const handleUserActivity = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !showSettings && !showEpisodes && !showLangMenu && !isAutoNexting) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000); 
    }
  };

  const toggleControls = (e) => {
    e?.stopPropagation();
    setShowControls((prev) => {
      const willShow = !prev;
      if (willShow) {
        clearTimeout(controlsTimeoutRef.current);
        if (isPlaying && !showSettings && !showEpisodes && !showLangMenu && !isAutoNexting) {
          controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        }
      } else {
        clearTimeout(controlsTimeoutRef.current);
      }
      return willShow;
    });
  };

  useEffect(() => {
    if (showControls) handleUserActivity();
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [isPlaying, showSettings, showEpisodes, showLangMenu, isAutoNexting]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (useIframe) return;
      const key = e.key.toLowerCase();
      handleUserActivity(); 
      if (key === ' ' || key === 'k') { e.preventDefault(); togglePlay(); }
      if (key === 'f') toggleFullscreen();
      if (key === 'm') toggleMute();
      if (key === 'j' || e.code === 'ArrowLeft') handleSkip(-10);
      if (key === 'l' || e.code === 'ArrowRight') handleSkip(10);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, useIframe, showSettings, showEpisodes, showLangMenu, isAutoNexting]);

  const handleSwitchEpisode = (ep) => {
    saveToFirebase(); // Lưu lại Firebase tiến trình tập cũ trước khi qua tập mới
    
    // 👇 FIX 1: Giết chết trí nhớ thời gian từ Firebase để tập mới chạy từ 0:00
    setActiveCloudProgress(null); 
    
    const newVideo = ep.link_m3u8 || ep.m3u8 || "";
    const newEmbed = ep.link_embed || ep.embed || "";

    setCurrentVideo(newVideo); 
    setCurrentEmbed(newEmbed);
    setCurrentEpName(ep.name);
    setUseIframe(false);
    setShowEpisodes(false); 
    setIsAutoNexting(false); 
    setIsPlaying(true);

    // 👇 FIX 2: Cập nhật luôn gói hàng `location.state` của URL. 
    // F5 một phát là nó nhớ luôn tập mới nhất chứ không bị thụt lùi nữa!
    navigate(location.pathname, {
      replace: true,
      state: {
        ...location.state,
        videoUrl: newVideo,
        embedFallback: newEmbed,
        epName: ep.name,
        cloudProgress: null // Đảm bảo F5 xong nó cũng tự xóa thời gian cũ
      }
    });
  };

  const handleSwitchLanguage = (idx) => {
    setActiveServerIdx(idx);
    const newServerEpisodes = allServers[idx].server_data || allServers[idx].items || [];
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    handleSwitchEpisode(equivalentEp);
    setShowLangMenu(false);
  };

  const renderEpisodeName = (name) => {
    if (!name) return "";
    return `Tập ${name.replace(/tập/gi, "").replace(/:/g, "").trim()}`;
  };

  if (!currentVideo && !currentEmbed) return null; 
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen bg-[#050505] text-white pt-6 md:pt-12 pb-20 font-sans overflow-hidden select-none">
      
      {/* AMBIENT ÁNH SÁNG */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-[100px] scale-110 saturate-150 transition-all duration-1000" 
          style={{ backgroundImage: `url(${posterUrl})` }}
        ></div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      <div className="relative z-20 max-w-[1260px] mx-auto px-2 md:px-4 mb-4 md:mb-6 flex items-center justify-between gap-4">
        <button 
          onClick={() => { saveToFirebase(); navigate(-1); }} 
          className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl md:rounded-2xl font-black transition-all text-[10px] md:text-xs tracking-widest backdrop-blur-xl shadow-[0_0_15px_rgba(255,255,255,0.05)] text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] shrink-0"
        >
          <span className="material-symbols-outlined text-sm md:text-lg">arrow_back</span>
          <span className="hidden sm:block">QUAY LẠI</span>
        </button>
        <div className="flex flex-col items-end drop-shadow-2xl max-w-[70%] sm:max-w-none">
          <h2 className="text-base md:text-2xl font-black uppercase tracking-tighter text-white truncate w-full text-right">{movieName}</h2>
          <span className="text-white font-bold text-[10px] md:text-sm tracking-widest bg-white/10 border border-white/10 px-2 py-0.5 md:px-3 md:py-1 rounded-md backdrop-blur-md mt-1">{renderEpisodeName(currentEpName)}</span>
        </div>
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-2 md:px-4">
        
        {/* --- KHUNG PHÁT VIDEO CHÍNH --- */}
        <div 
          ref={playerWrapperRef}
          className={`relative w-full aspect-video bg-black/90 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.9)] border border-white/10 group ${!showControls && isPlaying && !isAutoNexting ? 'cursor-none' : ''}`}
          onMouseMove={(e) => { 
            if (e.movementX === 0 && e.movementY === 0) return;
            handleUserActivity(); 
          }}
          onMouseLeave={() => { if (isPlaying && !showEpisodes && !showLangMenu && !showSettings && !isAutoNexting) setShowControls(false); }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showControls) {
                    handleUserActivity();
                  } else {
                    togglePlay();
                    handleUserActivity();
                  }
                }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (nextEpisode) {
                    setIsAutoNexting(true);
                    setAutoNextCounter(5);
                    setShowControls(true);
                  }
                }}
              />

              {/* MÀN HÌNH AUTO-NEXT */}
              {isAutoNexting && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-40 backdrop-blur-sm pointer-events-auto">
                  <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-white/20 border-t-white rounded-full animate-spin flex items-center justify-center mb-4 md:mb-6">
                    <span className="text-xl md:text-2xl font-black text-white absolute animate-none">{autoNextCounter}</span>
                  </div>
                  <h3 className="text-lg md:text-2xl font-black uppercase tracking-widest text-white mb-2">Tập tiếp theo</h3>
                  <p className="text-sm md:text-base text-zinc-400 mb-6 md:mb-8 font-medium">Tập {nextEpisode?.name}</p>
                  
                  <div className="flex gap-3 md:gap-4">
                    <button onClick={() => handleSwitchEpisode(nextEpisode)} className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm bg-white text-black font-black rounded-lg md:rounded-xl hover:scale-105 transition-all">PHÁT NGAY</button>
                    <button onClick={() => { setIsAutoNexting(false); setIsPlaying(false); }} className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm bg-white/10 text-white font-bold rounded-lg md:rounded-xl hover:bg-white/20 transition-all border border-white/20">HỦY BỎ</button>
                  </div>
                </div>
              )}

              {/* LỚP PHỦ MỜ */}
              <div className={`absolute inset-0 bg-black/40 pointer-events-none transition-opacity duration-300 z-10 ${!isPlaying || showControls ? 'opacity-100' : 'opacity-0'}`}></div>

              {/* NÚT PLAY/PAUSE Ở GIỮA */}
              {!isPlaying && !isAutoNexting && (
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-300 ${!isPlaying || showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                  <button 
                    className="pointer-events-auto w-16 h-16 md:w-24 md:h-24 bg-white/10 border border-white/30 text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] backdrop-blur-xl hover:bg-white/20 hover:scale-110 active:scale-95 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                      handleUserActivity();
                    }}
                  >
                    <span className={`material-symbols-outlined text-4xl md:text-6xl drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] ${isPlaying ? '' : 'ml-1 md:ml-2'}`}>
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                </div>
              )}

              {/* PANEL CHỌN TẬP */}
              <div className={`absolute top-0 right-0 bottom-0 w-[80%] sm:w-[350px] bg-black/70 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col transition-transform duration-300 ease-in-out ${showEpisodes ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-4 md:p-6 flex justify-between items-center border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
                  <h3 className="text-white font-black text-base md:text-xl tracking-tighter uppercase drop-shadow-md">Danh sách tập</h3>
                  <button onClick={() => setShowEpisodes(false)} className="text-zinc-400 hover:text-white transition-colors hover:rotate-90 transform duration-300">
                    <span className="material-symbols-outlined text-2xl md:text-3xl">close</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/40">
                  {currentEpisodes.map((ep) => (
                    <button 
                      key={ep.slug} 
                      onClick={() => handleSwitchEpisode(ep)}
                      className={`w-full flex items-center justify-between px-4 py-3 md:px-5 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 border ${
                        ep.name === currentEpName 
                          ? "bg-white/20 border-white/40 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]" 
                          : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white hover:scale-[1.02]"
                      }`}
                    >
                      <span>{renderEpisodeName(ep.name)}</span>
                      {ep.name === currentEpName && <span className="material-symbols-outlined text-base md:text-[20px] animate-pulse drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">play_circle</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* BOTTOM BAR */}
              <div className={`absolute bottom-0 left-0 right-0 pt-16 pb-4 px-4 md:px-6 bg-gradient-to-t from-black via-black/80 to-transparent z-30 transition-opacity duration-300 flex flex-col justify-end ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                
                <div 
                  ref={progressBarRef}
                  className="w-full h-1 md:h-1 hover:h-2 md:hover:h-2 bg-white/20 rounded-full cursor-pointer relative group/progress mb-3 md:mb-5 flex items-center transition-all duration-200" 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                >
                  <div className="absolute -inset-y-4 inset-x-0 bg-transparent z-10"></div> 
                  <div className="h-full bg-white rounded-full relative pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${progressPercent}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)] scale-0 group-hover/progress:scale-100 transition-transform"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-6">
                    <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl md:text-[40px]">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); handleSkip(-10); }} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl">replay_10</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSkip(10); }} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-3xl">forward_10</span>
                    </button>

                    <div className="flex items-center gap-2 group/volume relative hidden md:flex ml-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none">
                        <span className="material-symbols-outlined text-[28px]">{isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}</span>
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={handleVolumeChange}
                        className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 accent-white cursor-pointer h-1.5 bg-white/30 rounded-full appearance-none"
                      />
                    </div>

                    <div className="h-5 w-px bg-white/20 hidden md:block mx-2"></div>

                    <span className="text-[10px] md:text-[14px] font-semibold text-white/90 tracking-wide ml-1 md:ml-0">
                      {formatTime(currentTime)} <span className="mx-0.5 text-white/40">/</span> {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 md:gap-5 relative">
                    
                    {nextEpisode && (
                      <button onClick={(e) => { e.stopPropagation(); handleSwitchEpisode(nextEpisode); }} title="Tập Tiếp Theo" className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200">
                        <span className="material-symbols-outlined text-[22px] md:text-[32px]">skip_next</span>
                      </button>
                    )}

                    {allServers?.length > 1 && (
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setShowLangMenu(!showLangMenu); setShowSettings(false); setShowEpisodes(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200 ${showLangMenu ? 'drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Ngôn ngữ / Phiên bản">
                          <span className="material-symbols-outlined text-[22px] md:text-[32px]">subtitles</span>
                        </button>
                        
                        {showLangMenu && (
                          <div className="absolute bottom-full right-0 mb-4 w-40 md:w-48 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 py-2 origin-bottom transition-all">
                            <span className="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-1">Phiên bản</span>
                            {allServers.map((server, index) => (
                              <button 
                                key={index} 
                                onClick={(e) => { e.stopPropagation(); handleSwitchLanguage(index); }}
                                className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-bold text-left transition-colors flex items-center justify-between ${activeServerIdx === index ? 'text-white bg-white/20' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}`}
                              >
                                {server.server_name}
                                {activeServerIdx === index && <span className="material-symbols-outlined text-[14px] md:text-[16px] drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={(e) => { e.stopPropagation(); setShowEpisodes(!showEpisodes); setShowSettings(false); setShowLangMenu(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200 ${showEpisodes ? 'drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Danh sách tập">
                      <span className="material-symbols-outlined text-[22px] md:text-[32px]">video_library</span>
                    </button>

                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowEpisodes(false); setShowLangMenu(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:rotate-90 transform duration-300 ${showSettings ? 'rotate-90 drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Cài đặt">
                        <span className="material-symbols-outlined text-[22px] md:text-[32px]">settings</span>
                      </button>
                      
                      {showSettings && (
                        <div className="absolute bottom-full right-0 mb-4 w-32 md:w-36 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 py-2 origin-bottom transition-all">
                          <span className="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-1">Tốc độ</span>
                          {[0.5, 1, 1.5, 2].map((rate) => (
                            <button 
                              key={rate} 
                              onClick={(e) => { e.stopPropagation(); changeSpeed(rate); }}
                              className={`px-3 md:px-4 py-2 md:py-2 text-xs md:text-sm font-bold text-left transition-colors flex items-center justify-between ${playbackRate === rate ? 'text-white bg-white/20' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}`}
                            >
                              {rate === 1 ? 'Chuẩn' : `${rate}x`}
                              {playbackRate === rate && <span className="material-symbols-outlined text-[14px] md:text-[16px] drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">check</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-2xl md:text-[36px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* --- THANH "CONTROL CENTER" --- */}
        <div className="mt-4 md:mt-8 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 bg-white/5 border border-white/10 rounded-xl md:rounded-[1.5rem] p-3 md:p-6 backdrop-blur-2xl shadow-2xl relative z-10">
          
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <span className="material-symbols-outlined text-white text-xl md:text-2xl animate-pulse">router</span>
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-widest text-xs md:text-sm drop-shadow-md">Nguồn Phát</h3>
              <p className="text-zinc-400 text-[10px] md:text-xs mt-0.5">Nếu bị giật lag, hãy thử đổi Server khác nhé!</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
            <button 
              onClick={() => setUseIframe(!useIframe)} 
              className={`w-full md:w-auto px-4 py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 border shadow-lg backdrop-blur-md ${useIframe ? 'bg-white/20 border-white/40 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'bg-black/40 border-white/20 text-zinc-300 hover:text-white hover:bg-white/10'}`}
            >
              <span className="material-symbols-outlined text-base md:text-[20px]">{useIframe ? "cloud_done" : "dns"}</span>
              {useIframe ? "Đang dùng: Dự Phòng (Đổi về Chính)" : "Đang dùng: Server Chính (Đổi qua Dự Phòng)"}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
