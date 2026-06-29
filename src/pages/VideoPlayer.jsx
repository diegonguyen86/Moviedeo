import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js"; 
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp, increment } from "firebase/firestore";
import LoadingLogo from "../components/LoadingLogo";
import CommentSection from "../components/CommentSection";
import { apiGetRelatedSeasons, apiGetPhimDetail } from "../api/api";

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
  const [currentMovieName, setCurrentMovieName] = useState(movieName);
  const [currentPosterUrl, setCurrentPosterUrl] = useState(posterUrl);
  const [currentAllServers, setCurrentAllServers] = useState(allServers);
  const [currentSlug, setCurrentSlug] = useState(id);
  
  const [relatedSeasons, setRelatedSeasons] = useState([]);
  const [isLoadingSeason, setIsLoadingSeason] = useState(false);
  
  // Quản lý tiến trình Firebase (Trị Zombie Progress)
  const [activeCloudProgress, setActiveCloudProgress] = useState(cloudProgress);

  const [useIframe, setUseIframe] = useState(!videoUrl && !!embedFallback);
  
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

  // Cấu hình thời lượng quảng cáo (Tính bằng giây)
  // GHI CHÚ: Sau khi bạn đo xong chính xác quảng cáo dài bao nhiêu giây, hãy sửa số 15 ở đây thành con số thực tế nhé!
  const AD_DURATION_SECONDS = 31;

  // STATE: AUTO-NEXT
  const [isAutoNexting, setIsAutoNexting] = useState(false);
  const [autoNextCounter, setAutoNextCounter] = useState(5);

  // BỘ ĐẾM THỜI GIAN XEM THỰC TẾ
  const lastPlayTimeRef = useRef(Date.now());
  const unsavedWatchTimeRef = useRef(0);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      lastPlayTimeRef.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        unsavedWatchTimeRef.current += (now - lastPlayTimeRef.current) / 1000;
        lastPlayTimeRef.current = now;
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const rawEpisodes = currentAllServers?.[activeServerIdx]?.server_data || currentAllServers?.[activeServerIdx]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  // TÌM TẬP TIẾP THEO
  const currentIndex = currentEpisodes.findIndex(e => e.name === currentEpName);
  const nextEpisode = currentIndex !== -1 && currentIndex < currentEpisodes.length - 1 ? currentEpisodes[currentIndex + 1] : null;

  useEffect(() => {
    if (!videoUrl && !embedFallback) navigate(`/movie/${currentSlug}`, { replace: true });
  }, [videoUrl, embedFallback, currentSlug, navigate]);

  // Fetch related seasons once
  useEffect(() => {
    if (movieName) {
      // Find base name or just pass it
      apiGetRelatedSeasons(movieName, "").then(seasons => {
        setRelatedSeasons(seasons);
      });
    }
  }, [movieName]);

  const changeSeason = async (seasonSlug) => {
    if (seasonSlug === currentSlug || isLoadingSeason) return;
    setIsLoadingSeason(true);
    try {
      const res = await apiGetPhimDetail(seasonSlug);
      if (res && res.movie) {
        saveToFirebase(); // save current progress
        
        setCurrentMovieName(res.movie.name);
        setCurrentPosterUrl(res.movie.poster_url?.startsWith("http") ? res.movie.poster_url : `https://phimimg.com/${res.movie.poster_url}`);
        setCurrentAllServers(res.episodes || []);
        setCurrentSlug(seasonSlug);
        
        const newServers = res.episodes || [];
        const newEps = newServers[0]?.server_data || newServers[0]?.items || [];
        const firstEp = newEps[0];
        
        if (firstEp) {
          const nVideo = firstEp.link_m3u8 || firstEp.m3u8 || "";
          const nEmbed = firstEp.link_embed || firstEp.embed || "";
          
          setCurrentVideo(nVideo);
          setCurrentEmbed(nEmbed);
          setCurrentEpName(firstEp.name);
          setActiveServerIdx(0);
          setUseIframe(!nVideo && !!nEmbed);
          setActiveCloudProgress(null); // start from 0 for new season

          // Cập nhật lại đường dẫn URL trên trình duyệt để tránh bị lỗi khi user ấn F5
          navigate(`/play/${seasonSlug}`, {
            replace: true,
            state: {
              videoUrl: nVideo,
              embedFallback: nEmbed,
              movieName: res.movie.name,
              epName: firstEp.name,
              allServers: res.episodes || [],
              currentServerIndex: 0,
              posterUrl: res.movie.poster_url,
              cloudProgress: null
            }
          });
        }
      }
    } catch (e) {
      console.log("Error changing season:", e);
    } finally {
      setIsLoadingSeason(false);
    }
  };

  const saveToFirebase = async () => {
    if (!user || !currentMovieName) return;
    try {
      const historyRef = doc(db, "users", user.uid, "watchHistory", currentSlug);
      await setDoc(historyRef, {
        slug: currentSlug, movieId: currentSlug, title: currentMovieName, epName: currentEpName,
        image: currentPosterUrl, progress: videoRef.current?.currentTime || currentTime, lastWatched: serverTimestamp() 
      });

      // Lưu thời gian xem thực tế vào global
      const secondsToSave = Math.floor(unsavedWatchTimeRef.current);
      if (secondsToSave > 0) {
        unsavedWatchTimeRef.current = 0; // Reset ngay để tránh lưu trùng
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { totalWatchSeconds: increment(secondsToSave) }, { merge: true });
      }
    } catch (error) {}
  };

  // Tính lượt xem duy nhất cho thống kê cá nhân (chỉ chạy 1 lần khi load phim mới)
  useEffect(() => {
    const recordUniqueWatch = async () => {
      if (!user || !currentSlug) return;
      try {
        const historyRef = doc(db, "users", user.uid, "watchHistory", currentSlug);
        const snap = await getDoc(historyRef);
        
        // Nếu phim này chưa từng có trong lịch sử (hoặc đã bị xóa), thì cộng thêm 1 vào tổng phim đã xem
        if (!snap.exists()) {
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, { watchedCount: increment(1) }, { merge: true });
        }
      } catch (error) {
        console.error("Lỗi cập nhật thống kê:", error);
      }
    };
    recordUniqueWatch();
  }, [currentSlug, user]);

  useEffect(() => {
    window.scrollTo(0, 0);
    saveToFirebase();
  }, [currentVideo, useIframe]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || useIframe || !currentVideo) return;

    let hls;
    const safeVideoUrl = currentVideo.replace("http://", "https://");
    const localTime = localStorage.getItem(`progress_${currentSlug}_${currentEpName}`);
    
    // Dùng activeCloudProgress thay vì cloudProgress
    const savedTime = activeCloudProgress || localTime;

    // QUAN TRỌNG: Đặt lại thời gian về 0 trước khi nạp video mới để tránh lỗi dính thời gian của tập cũ
    video.currentTime = 0;
    setCurrentTime(0);

    let retryCount = 0;

    const onLoadedMetadata = () => {
      video.currentTime = savedTime ? parseFloat(savedTime) : 0;
      video.play().catch(() => {});
    };

    const onError = () => {
      // Nếu lỗi (đặc biệt khi từ background quay lại), thử load lại trước khi bỏ cuộc
      if (retryCount < 3) {
        retryCount++;
        // Đọc lại time mới nhất từ ổ cứng (tránh trường hợp video bị crash làm mất currentTime)
        const freshestTime = localStorage.getItem(`progress_${currentSlug}_${currentEpName}`);
        const recoverTime = freshestTime ? parseFloat(freshestTime) : (savedTime ? parseFloat(savedTime) : 0);
        
        video.src = safeVideoUrl;
        video.load();
        video.currentTime = recoverTime;
      } else {
        setUseIframe(true);
      }
    };

    let wasPlayingBeforeHidden = true;
    let wasHidden = document.hidden;

    const initHls = (autoPlay = true) => {
      if (hls) hls.destroy();
      hls = new Hls({ debug: false, enableWorker: true });
      
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(safeVideoUrl);
      });
      
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Lấy lại tiến trình mới nhất phòng khi crash
        const freshestTime = localStorage.getItem(`progress_${currentSlug}_${currentEpName}`);
        video.currentTime = freshestTime ? parseFloat(freshestTime) : (savedTime ? parseFloat(savedTime) : 0);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              if (retryCount < 3) {
                retryCount++;
                initHls(); // Khởi tạo lại HLS thay vì bỏ cuộc ngay
              } else {
                hls.destroy();
                setUseIframe(true);
              }
              break;
          }
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" || !document.hidden) {
        if (wasHidden) {
          wasHidden = false;
          if (video && wasPlayingBeforeHidden) {
            video.play().catch(() => {});
          }
        }
      } else {
        wasHidden = true;
        // TẮT MÀN HÌNH / ẨN WEB: Lập tức lưu tiến trình lên Firebase và LocalStorage
        saveToFirebase();
        if (video) {
          wasPlayingBeforeHidden = !video.paused;
          localStorage.setItem(`progress_${currentSlug}_${currentEpName}`, video.currentTime);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Xóa sự kiện focus vì nó gây lỗi re-init liên tục khi người dùng click chuột
    // window.addEventListener("focus", handleVisibilityChange);

    if (Hls.isSupported()) {
      initHls();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = safeVideoUrl;
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    }

    return () => { 
      if (hls) hls.destroy(); 
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentVideo, useIframe, currentEpName, currentSlug, activeCloudProgress]);

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

  const handleSkipAd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += AD_DURATION_SECONDS;
      // Tuỳ chọn: Có thể hiện một thông báo popup nhỏ báo hiệu đã skip quảng cáo
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
      localStorage.setItem(`progress_${currentSlug}_${currentEpName}`, videoRef.current.currentTime);
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
      
      // Không kích hoạt phím tắt nếu đang gõ trong input hoặc textarea (ví dụ: gõ bình luận)
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

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
    saveToFirebase(); 
    setActiveCloudProgress(null); 
    
    const newVideo = ep.link_m3u8 || ep.m3u8 || "";
    const newEmbed = ep.link_embed || ep.embed || "";

    setCurrentVideo(newVideo); 
    setCurrentEmbed(newEmbed);
    setCurrentEpName(ep.name);
    
    // Nếu không có m3u8 nhưng có embed thì tự động chuyển sang dùng Iframe
    setUseIframe(!newVideo && !!newEmbed);
    
    setShowEpisodes(false); 
    setIsAutoNexting(false); 
    setIsPlaying(true);

    navigate(location.pathname, {
      replace: true,
      state: {
        ...location.state,
        videoUrl: newVideo,
        embedFallback: newEmbed,
        epName: ep.name,
        cloudProgress: null 
      }
    });
  };

  const handleSwitchLanguage = (idx) => {
    setActiveServerIdx(idx);
    const newServerEpisodes = currentAllServers[idx].server_data || currentAllServers[idx].items || [];
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    handleSwitchEpisode(equivalentEp);
    setShowLangMenu(false);
  };

  const renderEpisodeName = (name) => {
    if (!name) return "";
    return `Tập ${String(name).replace(/tập/gi, "").replace(/:/g, "").trim()}`;
  };

  if (!currentVideo && !currentEmbed) return null; 
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen bg-[#050505] text-white pt-6 md:pt-12 pb-20 font-sans overflow-hidden select-none">
      
      {/* AMBIENT ÁNH SÁNG */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-[100px] scale-110 saturate-150 transition-all duration-1000" 
          style={{ backgroundImage: `url(${currentPosterUrl})` }}
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
          <h2 className="text-base md:text-2xl font-black uppercase tracking-tighter text-white truncate w-full text-right">{currentMovieName}</h2>
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
            <iframe src={currentEmbed?.replace("http://", "https://")} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <>
              {/* 👇 CẬP NHẬT MỚI: TÁCH BIỆT TRẢI NGHIỆM PC VÀ MOBILE QUA HARDWARE */}
              <video
                ref={videoRef}
                playsInline
                poster={currentPosterUrl}
                className="w-full h-full object-contain cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  
                  // Tuyệt chiêu soi phần cứng: Máy có chuột thật không?
                  const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

                  if (isDesktop) {
                    // PC (Có chuột): Bấm thẳng vào video để Play/Pause
                    togglePlay();
                    handleUserActivity();
                  } else {
                    // Mobile & iPad (Cảm ứng): Bấm vào video chỉ bật/tắt Menu
                    toggleControls(e);
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
                  <LoadingLogo className="w-20 h-20 md:w-24 md:h-24 mb-4 md:mb-6" />
                  <h3 className="text-lg md:text-2xl font-black uppercase tracking-widest text-white mb-2">Tập tiếp theo</h3>
                  <p className="text-sm md:text-base text-zinc-400 mb-6 md:mb-8 font-medium">Tập {nextEpisode?.name}</p>
                  
                  <div className="flex gap-3 md:gap-4">
                    <button onClick={() => handleSwitchEpisode(nextEpisode)} className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm bg-white text-black font-black rounded-lg md:rounded-xl hover:scale-105 transition-all">PHÁT NGAY</button>
                    <button onClick={() => { setIsAutoNexting(false); setIsPlaying(false); }} className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm bg-white/10 text-white font-bold rounded-lg md:rounded-xl hover:bg-white/20 transition-all border border-white/20">HỦY BỎ</button>
                  </div>
                </div>
              )}

              {/* LỚP PHỦ MỜ KHI HIỆN CONTROLS VÀ VÙNG NHẬN SỰ KIỆN CLICK (TỐI ƯU CẢ PC VÀ MOBILE) */}
              <div 
                className={`absolute inset-0 bg-black/40 transition-opacity duration-300 z-10 flex items-center justify-center ${!isPlaying || showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => {
                  const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
                  if (isDesktop) {
                    togglePlay();
                    handleUserActivity();
                  } else {
                    toggleControls(e);
                  }
                }}
                onDoubleClick={(e) => {
                  const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
                  if (isDesktop) {
                    toggleFullscreen();
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    if (x < rect.width / 3) {
                      handleSkip(-10); // Lùi 10s bên trái
                    } else if (x > (rect.width * 2) / 3) {
                      handleSkip(10);  // Tiến 10s bên phải
                    } else {
                      toggleFullscreen(); // Phóng to ở giữa
                    }
                  }
                }}
              >
                {/* CỤM NÚT TRUNG TÂM */}
                {!isAutoNexting && (
                  <div className={`flex items-center justify-center gap-6 md:gap-20 transition-transform duration-300 ${!isPlaying || showControls ? 'scale-100' : 'scale-90'}`}>
                    
                    {/* Lùi 10s */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSkip(-10); handleUserActivity(); }} 
                      className="text-white hover:text-yellow-400 hover:scale-110 transition-all drop-shadow-lg p-2 md:p-4"
                    >
                      <span className="material-symbols-outlined text-4xl md:text-[48px]">replay_10</span>
                    </button>

                    {/* Play/Pause */}
                    <button 
                      className="relative w-16 h-16 md:w-20 md:h-20 bg-white/10 border border-white/40 text-white rounded-full flex items-center justify-center backdrop-blur-xl hover:bg-white hover:text-black hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] group/play"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                        handleUserActivity();
                      }}
                    >
                      {!isPlaying && <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white group-hover/play:bg-black group-hover/play:opacity-10"></div>}
                      <span className="material-symbols-outlined text-4xl md:text-5xl drop-shadow-md z-10" style={{ fontVariationSettings: "'FILL' 1", marginLeft: isPlaying ? '0' : '4px' }}>
                        {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    {/* Tiến 10s */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSkip(10); handleUserActivity(); }} 
                      className="text-white hover:text-yellow-400 hover:scale-110 transition-all drop-shadow-lg p-2 md:p-4"
                    >
                      <span className="material-symbols-outlined text-4xl md:text-[48px]">forward_10</span>
                    </button>
                  </div>
                )}

              </div>

              {/* PANEL CHỌN TẬP */}
              <div className={`absolute top-0 right-0 bottom-0 w-[80%] sm:w-[350px] bg-black/70 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col transition-transform duration-300 ease-in-out ${showEpisodes ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-4 md:p-6 flex justify-between items-center border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
                  <h3 className="text-white font-black text-base md:text-xl tracking-tighter uppercase drop-shadow-md">Danh sách tập</h3>
                  <button onClick={() => setShowEpisodes(false)} className="text-zinc-400 hover:text-white transition-colors hover:rotate-90 transform duration-300">
                    <span className="material-symbols-outlined text-2xl md:text-3xl">close</span>
                  </button>
                </div>
                
                {/* SEASON SELECTOR IN PLAYER */}
                {relatedSeasons.length > 1 && (
                  <div className="p-4 border-b border-white/10">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Phần phim</span>
                    <div className="flex flex-wrap gap-2">
                      {relatedSeasons.map(season => {
                        const isActive = season.id === currentSlug;
                        return (
                          <button 
                            key={season.id}
                            onClick={() => changeSeason(season.id)}
                            disabled={isLoadingSeason}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isActive ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'} ${isLoadingSeason ? 'opacity-50' : 'opacity-100'}`}
                          >
                            Phần {season.seasonNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/40 relative">
                  {isLoadingSeason && (
                    <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm">
                      <LoadingLogo className="w-12 h-12" />
                    </div>
                  )}
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
              <div className={`absolute bottom-0 left-0 right-0 pt-24 pb-4 px-4 md:px-6 bg-gradient-to-t from-black via-black/80 to-transparent z-30 transition-opacity duration-300 flex flex-col justify-end ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                
                {/* NÚT BỎ QUA QUẢNG CÁO (Nổi lên góc trái trên thanh trượt) */}
                <div className="absolute left-4 md:left-8 bottom-[70px] md:bottom-[80px] z-40">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSkipAd(); }} 
                    className="flex items-center gap-1.5 bg-black/50 border border-white/20 text-white/80 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full backdrop-blur-md hover:text-white hover:bg-white/10 hover:border-white/40 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px] md:text-[16px]">fast_forward</span>
                    <span className="font-bold text-[9px] md:text-[10px] uppercase tracking-wider">Skip ADs</span>
                  </button>
                </div>

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
                      <span className="material-symbols-outlined text-3xl md:text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>{isPlaying ? 'pause_circle' : 'play_circle'}</span>
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); handleSkip(-10); }} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-[28px] md:text-3xl">replay_10</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSkip(10); }} className="text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hidden sm:block hover:scale-110 transform duration-200">
                      <span className="material-symbols-outlined text-[28px] md:text-3xl">forward_10</span>
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


                    {currentAllServers?.length > 1 && (
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setShowLangMenu(!showLangMenu); setShowSettings(false); setShowEpisodes(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:scale-110 transform duration-200 ${showLangMenu ? 'drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Ngôn ngữ / Phiên bản">
                          <span className="material-symbols-outlined text-[22px] md:text-[28px]">subtitles</span>
                        </button>
                        
                        {showLangMenu && (
                          <div className="absolute bottom-full right-0 mb-4 w-40 md:w-48 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 py-2 origin-bottom transition-all">
                            <span className="px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-1">Phiên bản</span>
                            {currentAllServers.map((server, index) => (
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
                      <span className="material-symbols-outlined text-[22px] md:text-[28px]">video_library</span>
                    </button>

                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowEpisodes(false); setShowLangMenu(false); }} className={`text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all focus:outline-none hover:rotate-90 transform duration-300 ${showSettings ? 'rotate-90 drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : ''}`} title="Cài đặt">
                        <span className="material-symbols-outlined text-[22px] md:text-[28px]">settings</span>
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
                      <span className="material-symbols-outlined text-[24px] md:text-[30px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* NÚT TẬP TIẾP THEO (ĐƯA RA NGOÀI ĐỂ KHÔNG BỊ BOTTOM BAR CHE MẤT, CHỈ HIỆN Ở 5 PHÚT CUỐI) */}
              {!isAutoNexting && nextEpisode && duration > 0 && (duration - currentTime <= 300) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleSwitchEpisode(nextEpisode); }} 
                  className={`absolute right-4 bottom-20 md:right-8 md:bottom-28 flex items-center gap-2 bg-black/60 border border-white/20 text-white px-4 py-2.5 md:px-6 md:py-3 rounded-full backdrop-blur-xl hover:bg-yellow-500 hover:text-black hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] z-40 group ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                >
                  <span className="font-bold text-[11px] md:text-sm uppercase tracking-wider">Tập tiếp theo</span>
                  <span className="material-symbols-outlined text-xl md:text-2xl group-hover:translate-x-1 transition-transform">skip_next</span>
                </button>
              )}
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

        {/* --- BÌNH LUẬN NATIVE --- */}
        <div className="mt-4 md:mt-8 relative z-10 max-w-5xl mx-auto">
          <CommentSection movieId={currentSlug} movieName={currentMovieName} />
        </div>

      </div>
    </main>
  );
}
