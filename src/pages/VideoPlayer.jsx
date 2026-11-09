import { useNavigate, useLocation, useParams, Navigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp, increment } from "firebase/firestore";
import LoadingLogo from "../components/LoadingLogo";
import CommentSection from "../components/CommentSection";
import { PlayIcon, PauseIcon, Back10Icon, Fwd10Icon, VolumeIcon, EpisodesIcon, SpeedIcon, SubtitlesIcon, FullscreenIcon, ExitFullscreenIcon, NextIcon } from "../components/PlayerIcons";
import { apiGetRelatedSeasons, apiGetPhimDetail, apiGetPhimTheoTheLoai } from "../api/api";

const toFullImageUrl = (url) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://phimimg.com/${url}`;
};

// Trang /play nằm ngoài Layout nên phải tự chặn người chưa đăng nhập / chưa được duyệt.
// (Trước đây chỉ có comment "tự bảo vệ" nhưng thực tế ai mở link /play/... cũng xem được.)
export default function VideoPlayerGuard() {
  const { user, isApproved, hasPassword } = useAuth();
  if (!user || !isApproved || !hasPassword) {
    return <Navigate to="/" replace />;
  }
  return <VideoPlayer />;
}

function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const { user } = useAuth();
  
  const { videoUrl, embedFallback, movieName, epName, allServers, currentServerIndex, posterUrl, cloudProgress } = location.state || {};

  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const controlsShownAtRef = useRef(0);
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
  
  // ĐỀ XUẤT PHIM CÙNG THỂ LOẠI KHI HẾT PHIM (BUG 6 NÂNG CẤP)
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [recommendCategoryName, setRecommendCategoryName] = useState("");
  const [showRecommendations, setShowRecommendations] = useState(false);
  
  // Quản lý tiến trình Firebase (Trị Zombie Progress)
  const [activeCloudProgress, setActiveCloudProgress] = useState(cloudProgress);

  const [useIframe, setUseIframe] = useState(!videoUrl && !!embedFallback);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const lastSavedTimeRef = useRef(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false); 

  // AUTO-SKIP AD REFS (QUÉT CHUẨN MÀU ĐỎ PHÚT 15 - SIÊU NHANH & KHÔNG TRỄ)
  const videoCanvasRef = useRef(null);
  const hasSkippedAdRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const canScanAdRef = useRef(true);
  const [adNotice, setAdNotice] = useState(null);
  const adNoticeTimerRef = useRef(null);

  // Cấu hình thời lượng quảng cáo (Tính bằng giây)
  const AD_DURATION_SECONDS = 31.5;

  const showAdNotice = (msg, canUndo = false) => {
    setAdNotice({ msg, canUndo });
    clearTimeout(adNoticeTimerRef.current);
    adNoticeTimerRef.current = setTimeout(() => {
      setAdNotice(null);
    }, 4500);
  };

  const handleUndoSkip = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - AD_DURATION_SECONDS);
      hasSkippedAdRef.current = false;
      setAdNotice(null);
    }
  };

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
    // Tự động khôi phục phim khi người dùng F5 hoặc truy cập trực tiếp link /play/:id
    if (!currentVideo && !currentEmbed && currentSlug) {
      let isMounted = true;
      apiGetPhimDetail(currentSlug)
        .then((res) => {
          if (!isMounted) return;
          if (res && res.movie) {
            setCurrentMovieName(res.movie.name);
            setCurrentPosterUrl(toFullImageUrl(res.movie.poster_url));
            const servers = res.episodes || [];
            setCurrentAllServers(servers);
            const eps = servers[0]?.server_data || servers[0]?.items || [];
            if (eps.length > 0) {
              const ep = eps[0];
              const nVideo = ep.link_m3u8 || ep.m3u8 || "";
              const nEmbed = ep.link_embed || ep.embed || "";
              setCurrentVideo(nVideo);
              setCurrentEmbed(nEmbed);
              setCurrentEpName(ep.name);
              setActiveServerIdx(0);
              setUseIframe(!nVideo && !!nEmbed);
              return;
            }
          }
          navigate(`/movie/${currentSlug}`, { replace: true });
        })
        .catch(() => {
          if (isMounted) navigate(`/movie/${currentSlug}`, { replace: true });
        });
      return () => {
        isMounted = false;
      };
    }
  }, [currentVideo, currentEmbed, currentSlug, navigate]);

  // Tự động lấy danh sách phim cùng thể loại để đề xuất khi hết phim
  useEffect(() => {
    if (!currentSlug) return;
    let isMounted = true;
    apiGetPhimDetail(currentSlug)
      .then((res) => {
        if (!isMounted || !res || !res.movie) return;
        const categories = res.movie.category || [];
        if (categories.length > 0) {
          const mainCat = categories[0];
          setRecommendCategoryName(mainCat.name);
          apiGetPhimTheoTheLoai(mainCat.slug, 1)
            .then((catRes) => {
              if (!isMounted) return;
              const items = catRes?.data?.items || catRes?.items || [];
              const filtered = items.filter((m) => m.slug !== currentSlug);
              setRecommendedMovies(filtered.slice(0, 6));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [currentSlug]);

  // Lấy danh sách các phần liên quan (dùng currentMovieName để vẫn chạy khi F5 / mở link trực tiếp)
  const seasonsBaseNameRef = useRef(null);
  useEffect(() => {
    if (!currentMovieName) return;
    // Đã có danh sách chứa phim hiện tại (vừa đổi phần) thì không cần tìm lại
    if (seasonsBaseNameRef.current && relatedSeasons.some(s => s.id === currentSlug)) return;
    seasonsBaseNameRef.current = currentMovieName;
    let isMounted = true;
    apiGetRelatedSeasons(currentMovieName, "")
      .then(seasons => { if (isMounted) setRelatedSeasons(seasons); })
      .catch(() => {});
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMovieName]);

  const changeSeason = async (seasonSlug) => {
    if (seasonSlug === currentSlug || isLoadingSeason) return;
    setIsLoadingSeason(true);
    try {
      const res = await apiGetPhimDetail(seasonSlug);
      if (res && res.movie) {
        saveToFirebase(); // save current progress
        
        const newServers = res.episodes || [];
        const newEps = newServers[0]?.server_data || newServers[0]?.items || [];
        const firstEp = newEps[0];

        if (firstEp) {
          // Chỉ đổi thông tin phim khi phần mới thực sự có tập để phát
          setCurrentMovieName(res.movie.name);
          setCurrentPosterUrl(toFullImageUrl(res.movie.poster_url));
          setCurrentAllServers(newServers);
          setCurrentSlug(seasonSlug);
          hasSkippedAdRef.current = false;
          canScanAdRef.current = true;

          const nVideo = firstEp.link_m3u8 || firstEp.m3u8 || "";
          const nEmbed = firstEp.link_embed || firstEp.embed || "";
          
          setCurrentVideo(nVideo);
          setCurrentEmbed(nEmbed);
          setCurrentEpName(firstEp.name);
          setActiveServerIdx(0);
          setUseIframe(!nVideo && !!nEmbed);
          setActiveCloudProgress(null); // start from 0 for new season
          setShowRecommendations(false);

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
              posterUrl: toFullImageUrl(res.movie.poster_url),
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
    if (!user || !currentMovieName || !currentSlug) return;
    try {
      const currentProgress = videoRef.current?.currentTime || currentTime;
      // Chưa xem giây nào (vd: vừa mở trang đã thoát, hoặc đang dùng server dự phòng iframe)
      // -> không ghi đè tiến trình cũ trên Firebase về 0
      if (!currentProgress && unsavedWatchTimeRef.current < 1) return;

      let epToSave = currentEpName;
      let progressToSave = currentProgress;
      
      // Thuật toán gỡ bẫy End-Credit: Chuyển thẳng sang tập tiếp theo nếu đã xem > 95%
      if (duration > 0 && currentProgress >= duration * 0.95) {
        if (nextEpisode) {
          epToSave = nextEpisode.name;
          progressToSave = 0;
        } else {
          // Phim lẻ hoặc tập cuối: Reset tiến trình về 0 để không bị kẹt ở credit
          progressToSave = 0;
        }
      }

      // Backup tiến trình vào máy để chắc chắn 100% không mất
      if (progressToSave >= 0) {
        localStorage.setItem(`progress_${currentSlug}_${epToSave}`, progressToSave);
      }

      const historyRef = doc(db, "users", user.uid, "watchHistory", currentSlug);
      await setDoc(historyRef, {
        slug: currentSlug, movieId: currentSlug, title: currentMovieName, epName: epToSave,
        image: currentPosterUrl, progress: progressToSave, lastWatched: serverTimestamp() 
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
  }, [currentVideo, useIframe]);

  // ĐẢM BẢO LƯU TIẾN TRÌNH KHI NGƯỜI DÙNG RỜI KHỎI TRANG (UNMOUNT)
  const saveProgressRef = useRef(saveToFirebase);
  useEffect(() => { saveProgressRef.current = saveToFirebase; });
  useEffect(() => {
    return () => {
      saveProgressRef.current();
    };
  }, []);

  // AUTO-SAVE TIẾT KIỆM QUOTA FIREBASE:
  // Tiến trình chi tiết đã được lưu liên tục mỗi giây vào localStorage của máy.
  // Lên Firebase chỉ đẩy định kỳ mỗi 15 phút (hoặc khi thoát/đổi tập/ẩn tab/hết phim) để tránh hao quota 20k writes/ngày của gói Free.
  useEffect(() => {
    if (!isPlaying) return;
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    const interval = setInterval(() => {
      saveProgressRef.current();
    }, FIFTEEN_MINUTES);
    return () => clearInterval(interval);
  }, [isPlaying]);

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
    let networkRetry = 0;
    let mediaRetry = 0;
    let disposed = false;

    const onLoadedMetadata = () => {
      video.currentTime = savedTime ? parseFloat(savedTime) : 0;
      video.play().catch(() => {});
    };

    const onError = () => {
      // Tự động phục hồi nếu video bị lỗi do thuộc tính crossorigin trên mobile
      if (video && video.hasAttribute("crossorigin")) {
        video.removeAttribute("crossorigin");
        canScanAdRef.current = false;
        video.src = safeVideoUrl;
        video.load();
        video.play().catch(() => {});
        return;
      }
      if (retryCount < 3) {
        retryCount++;
        const freshestTime = localStorage.getItem(`progress_${currentSlug}_${currentEpName}`);
        const recoverTime = freshestTime ? parseFloat(freshestTime) : (savedTime ? parseFloat(savedTime) : 0);
        video.src = safeVideoUrl;
        video.load();
        video.currentTime = recoverTime;
      } else if (currentEmbed) {
        setUseIframe(true);
      }
    };

    let wasPlayingBeforeHidden = true;
    let wasHidden = document.hidden;

    const initHls = (autoPlay = true) => {
      if (hls) hls.destroy();
      hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        startFragPrefetch: true
      });
      
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
              // Trước đây thử lại VÔ HẠN -> mạng 4G yếu / link hỏng là quay vòng "Đang tải..." mãi.
              // Giờ thử tối đa 4 lần (cách nhau 1.5s), sau đó tự chuyển sang server dự phòng.
              if (networkRetry < 4) {
                networkRetry++;
                setTimeout(() => { try { if (hls && !disposed) hls.startLoad(); } catch {} }, 1500);
              } else {
                hls.destroy();
                hls = null;
                if (currentEmbed) setUseIframe(true);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRetry < 2) {
                mediaRetry++;
                hls.recoverMediaError();
              } else if (retryCount < 3) {
                retryCount++;
                initHls();
              } else {
                hls.destroy();
                hls = null;
                if (currentEmbed) setUseIframe(true);
              }
              break;
            default:
              if (retryCount < 3) {
                retryCount++;
                initHls(); // Khởi tạo lại HLS thay vì bỏ cuộc ngay
              } else {
                hls.destroy();
                hls = null;
                if (currentEmbed) setUseIframe(true);
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
        // Dùng ref để luôn gọi bản saveToFirebase mới nhất (tránh closure cũ với duration = 0)
        saveProgressRef.current();
        if (video) {
          wasPlayingBeforeHidden = !video.paused;
          localStorage.setItem(`progress_${currentSlug}_${currentEpName}`, video.currentTime);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Xóa sự kiện focus vì nó gây lỗi re-init liên tục khi người dùng click chuột
    // window.addEventListener("focus", handleVisibilityChange);

    // iPhone / iPad / Safari: ưu tiên trình phát HLS gốc của Apple (ổn định, ít tốn pin, không phụ thuộc MediaSource).
    // hls.js trên iOS đời mới vẫn "isSupported" nhưng hay lỗi -> trước đây iPhone hay không load được phim.
    const ua = navigator.userAgent;
    const isAppleWebKit = /iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ||
      (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|Android/i.test(ua));
    const canPlayNativeHls = !!video.canPlayType("application/vnd.apple.mpegurl");

    if (isAppleWebKit && canPlayNativeHls) {
      video.src = safeVideoUrl;
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    } else if (Hls.isSupported()) {
      initHls();
    } else if (canPlayNativeHls) {
      video.src = safeVideoUrl;
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    } else if (currentEmbed) {
      // Trình duyệt không phát được HLS -> dùng server dự phòng luôn
      setUseIframe(true);
    }

    return () => {
      disposed = true;
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
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        const p = videoRef.current.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn("Autoplay bị trình duyệt chặn:", err);
            setIsPlaying(false);
            setShowControls(true);
          });
        }
      }
    }
  };

  // 👇 XỬ LÝ CHẠM MÀN HÌNH CHUẨN XÁC TRÊN CẢ MOBILE VÀ PC:
  // - Nếu video đang dừng: Chạm bất cứ đâu là PHÁT NGAY LẬP TỨC (không bị đơ, không cần reload trang)
  // - Nếu video đang phát: Trên PC bấm để Pause, trên Mobile chạm để bật/tắt thanh điều khiển
  const handlePlayerTap = (e) => {
    e?.stopPropagation();
    if (!isPlaying) {
      togglePlay();
      handleUserActivity();
      return;
    }
    const isDesktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (isDesktop) {
      togglePlay();
      handleUserActivity();
    } else {
      toggleControls(e);
    }
  };

  const handleSkip = (amount) => {
    if (videoRef.current) videoRef.current.currentTime += amount;
  };

  const handleSkipAd = (reason = "manual") => {
    if (videoRef.current) {
      videoRef.current.currentTime += AD_DURATION_SECONDS;
      hasSkippedAdRef.current = true;
      showAdNotice(
        reason === "auto" 
          ? "⚡ Đã tự động bỏ qua quảng cáo" 
          : "⏩ Đã bỏ qua 30s quảng cáo", 
        true
      );
    }
  };

  // NHẬN DIỆN CHUẨN MÀU ĐỎ Ở PHÚT 15 - ĐÃ TỐI ƯU ĐỘ TRỄ (< 0.2 GIÂY)
  const detectAdAndSkip = () => {
    const video = videoRef.current;
    if (!video || hasSkippedAdRef.current || !canScanAdRef.current || video.paused || video.ended) return;

    // TỐI ƯU ĐỘ TRỄ: Quét mỗi 200ms (thay vì 1500ms như trước) để bắt dính ngay lập tức
    const now = Date.now();
    if (now - lastScanTimeRef.current < 200) return;
    lastScanTimeRef.current = now;

    try {
      if (!videoCanvasRef.current) {
        const c = document.createElement("canvas");
        c.width = 40;
        c.height = 40;
        videoCanvasRef.current = c;
      }
      const canvas = videoCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      
      const relX = 0.40; 
      const relY = 0.50; 
      const relW = 0.20; 
      const relH = 0.30;
      
      const sx = video.videoWidth * relX;
      const sy = video.videoHeight * relY;
      const sw = video.videoWidth * relW;
      const sh = video.videoHeight * relH;

      if (!sw || !sh || isNaN(sw) || isNaN(sh)) return;

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 40, 40);

      const videoPixels = ctx.getImageData(0, 0, 40, 40);
      let redCount = 0;
      const totalPixels = 40 * 40;

      for (let i = 0; i < videoPixels.data.length; i += 4) {
        const r = videoPixels.data[i];
        const g = videoPixels.data[i+1];
        const b = videoPixels.data[i+2];

        // Điều kiện chuẩn xác ban đầu: Nhận diện màu Đỏ Rực (áo người trong quảng cáo)
        // Không thêm bất kỳ màu nào khác để tránh tuyệt đối việc nhầm lẫn với phim
        if (r > 120 && g < 70 && b < 80 && r > g * 2 && r > b * 2) {
          redCount++;
        }
      }

      const redPercentage = redCount / totalPixels;
      if (redPercentage > 0.15) {
        handleSkipAd("auto");
      }
    } catch (e) {
      if (e.name === "SecurityError" || e.message?.includes("tainted")) {
        canScanAdRef.current = false;
      }
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

    const isCurrentlyFullscreen = !!(
      document.fullscreenElement || 
      document.webkitFullscreenElement ||
      (video && video.webkitDisplayingFullscreen)
    );

    if (!isCurrentlyFullscreen) {
      try {
        if (elem?.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem?.webkitRequestFullscreen) { 
          await elem.webkitRequestFullscreen();
        } else if (video?.webkitEnterFullscreen) { 
          video.webkitEnterFullscreen();
        }
      } catch (err) {
        if (video?.webkitEnterFullscreen) {
          try { video.webkitEnterFullscreen(); } catch (e) {}
        }
      }
      
      try {
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      } catch (error) {}
      
      setIsFullscreen(true);
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (video?.webkitExitFullscreen) {
          video.webkitExitFullscreen();
        }
      } catch (err) {}

      try {
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
      } catch (error) {}

      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement || 
        document.webkitFullscreenElement ||
        (videoRef.current && videoRef.current.webkitDisplayingFullscreen)
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    
    const video = videoRef.current;
    if (video) {
      video.addEventListener("webkitbeginfullscreen", handleFullscreenChange);
      video.addEventListener("webkitendfullscreen", handleFullscreenChange);
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (video) {
        video.removeEventListener("webkitbeginfullscreen", handleFullscreenChange);
        video.removeEventListener("webkitendfullscreen", handleFullscreenChange);
      }
    };
  }, []);

  const handlePointerUpdate = (e) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos)); 
    setSeekTime(pos * duration);
  };

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    handlePointerUpdate(e);
  };

  const handlePointerMove = (e) => {
    if (e.buttons === 1 && isDragging) handlePointerUpdate(e); 
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);
      if (Math.abs(current - lastSavedTimeRef.current) >= 1) {
        localStorage.setItem(`progress_${currentSlug}_${currentEpName}`, current);
        lastSavedTimeRef.current = current;
      }

      // Quét tự động ở phút 15 (từ giây 840 đến giây 1020)
      if (current >= 840 && current <= 1020 && !hasSkippedAdRef.current) {
        detectAdAndSkip();
      }
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
    // Điều khiển vừa được bật bởi chính cử chỉ này (mousemove ngay trước click) -> giữ nguyên, không tắt đi
    if (Date.now() - controlsShownAtRef.current < 500) {
      controlsShownAtRef.current = 0;
      handleUserActivity();
      return;
    }
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
    if (!ep) return;
    saveToFirebase();
    setActiveCloudProgress(null); 
    hasSkippedAdRef.current = false; // Reset cờ skip quảng cáo khi chuyển tập
    canScanAdRef.current = true;
    
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
    const newServerEpisodes = currentAllServers?.[idx]?.server_data || currentAllServers?.[idx]?.items || [];
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    setShowLangMenu(false);
    if (!equivalentEp) return; // Server này không có tập nào -> giữ nguyên server hiện tại
    setActiveServerIdx(idx);
    handleSwitchEpisode(equivalentEp);
    navigate(location.pathname, {
      replace: true,
      state: { ...location.state, currentServerIndex: idx, videoUrl: equivalentEp.link_m3u8 || equivalentEp.m3u8 || "", embedFallback: equivalentEp.link_embed || equivalentEp.embed || "", epName: equivalentEp.name, cloudProgress: null }
    });
  };

  // Khuôn nút điều khiển: tròn 40px, icon 24px, rê thì nền mờ (mọi nút cùng một cỡ)
  const CTRL = "flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white";
  // Khuôn menu bật lên từ thanh điều khiển (phiên bản, tốc độ)
  const MENU = "animate-fade-in absolute bottom-full right-0 z-50 mb-3 flex w-44 flex-col gap-0.5 rounded-xl border border-white/10 bg-raised/95 p-1.5 shadow-2xl";

  const renderEpisodeName = (name) => {
    if (!name) return "";
    const clean = String(name).replace(/tập/gi, "").replace(/:/g, "").trim();
    return /^\d+$/.test(clean) ? `Tập ${clean}` : clean; // "Full", "Trailer" giữ nguyên

  };

  const displayTime = isDragging ? seekTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen bg-canvas text-white pt-6 md:pt-12 pb-20 font-sans overflow-hidden select-none">
      
      {/* AMBIENT ÁNH SÁNG */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 md:opacity-40 blur-2xl md:blur-[100px] scale-105 md:scale-110 saturate-150 transition-all duration-1000 transform-gpu will-change-transform" 
          style={{ backgroundImage: `url(${currentPosterUrl})` }}
        ></div>
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* Đầu trang: nút quay lại + tên phim, tập (đọc từ trái sang như mọi app xem phim) */}
      <div className="relative z-20 mx-auto mb-4 flex max-w-[1260px] items-center gap-3 px-3 md:mb-5 md:px-4">
        <button
          onClick={() => { saveToFirebase(); navigate(-1); }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Quay lại"
          title="Quay lại"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-white md:text-xl">{currentMovieName}</h1>
          {currentEpName && <p className="text-sm text-white/60">{renderEpisodeName(currentEpName)}</p>}
        </div>
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-2 md:px-4">
        
        {/* --- KHUNG PHÁT VIDEO CHÍNH --- */}
        <div 
          ref={playerWrapperRef}
          className={`relative w-full aspect-video bg-black/90 rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 group ${!showControls && isPlaying && !isAutoNexting ? 'cursor-none' : ''}`}
          // Chỉ chuột thật mới được "rê để hiện điều khiển".
          // Trên điện thoại mỗi cú chạm sinh ra mousemove giả trước khi click -> trước đây mousemove bật điều khiển lên,
          // rồi click lập tức tắt đi => chạm vào video không bao giờ hiện được nút.
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            if (e.movementX === 0 && e.movementY === 0) return;
            if (!showControls) controlsShownAtRef.current = Date.now();
            handleUserActivity();
          }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse" && isPlaying && !showEpisodes && !showLangMenu && !showSettings && !isAutoNexting) setShowControls(false); }}
        >
          {useIframe ? (
            <iframe src={currentEmbed?.replace("http://", "https://")} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <>
              {/* 👇 CẬP NHẬT MỚI: TÁCH BIỆT TRẢI NGHIỆM PC VÀ MOBILE QUA HARDWARE */}
              <video
                ref={videoRef}
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                preload="auto"
                crossOrigin="anonymous"
                className="w-full h-full object-contain cursor-pointer"
                onClick={handlePlayerTap}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
                onCanPlay={() => setIsBuffering(false)}
                onSeeking={() => setIsBuffering(true)}
                onSeeked={() => setIsBuffering(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  saveToFirebase();
                  if (nextEpisode) {
                    setIsAutoNexting(true);
                    setAutoNextCounter(5);
                    setShowControls(true);
                  } else {
                    setShowRecommendations(true);
                    setShowControls(true);
                  }
                }}
              />

              {/* ẢNH POSTER: không dùng thuộc tính poster của <video> vì video có crossOrigin (để quét quảng cáo)
                  khiến poster bị tải kiểu CORS -> phimimg.com chặn -> trước khi phát chỉ thấy khung đen */}
              {currentPosterUrl && !isPlaying && currentTime < 1 && (
                <img
                  src={currentPosterUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-70"
                />
              )}

              {/* HIỆU ỨNG BUFFERING KHI MẠNG MOBILE CHẬM */}
              {isBuffering && isPlaying && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 bg-black/30 backdrop-blur-[2px]">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
                  <span className="text-[11px] font-bold text-white/80 mt-2 tracking-widest uppercase">Đang tải...</span>
                </div>
              )}

              {/* MÀN HÌNH AUTO-NEXT */}
              {isAutoNexting && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-40 backdrop-blur-sm pointer-events-auto">
                  <LoadingLogo className="w-20 h-20 md:w-24 md:h-24 mb-4 md:mb-6" />
                  <h3 className="text-lg md:text-2xl font-semibold uppercase tracking-widest text-white mb-2">Tập tiếp theo</h3>
                  <p className="text-sm md:text-base text-zinc-400 mb-6 md:mb-8 font-medium">Tập {nextEpisode?.name}</p>
                  
                  <div className="flex gap-3 md:gap-4">
                    <button onClick={() => handleSwitchEpisode(nextEpisode)} className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm bg-white text-black font-semibold rounded-lg md:rounded-xl hover:scale-105 transition-all">PHÁT NGAY</button>
                    <button onClick={() => { setIsAutoNexting(false); setIsPlaying(false); }} className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm bg-white/10 text-white font-bold rounded-lg md:rounded-xl hover:bg-white/20 transition-all border border-white/20">HỦY BỎ</button>
                  </div>
                </div>
              )}

              {/* MÀN HÌNH ĐỀ XUẤT PHIM CÙNG THỂ LOẠI (KHI HẾT PHIM / TẬP CUỐI) */}
              {showRecommendations && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-40 flex flex-col justify-between p-4 md:p-6 lg:p-8 animate-in fade-in duration-300 pointer-events-auto">
                  {/* Header đề xuất */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-white text-xs md:text-sm font-semibold uppercase tracking-wider mb-1">
                        <span className="material-symbols-outlined text-base md:text-lg">auto_awesome</span>
                        <span>Đề xuất tiếp theo</span>
                      </div>
                      <h3 className="text-base md:text-xl lg:text-2xl font-semibold text-white uppercase tracking-tight">
                        Cùng thể loại {recommendCategoryName ? `"${recommendCategoryName}"` : ""}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowRecommendations(false);
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            videoRef.current.play().catch(() => {});
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs md:text-sm font-bold transition-all border border-white/10 shadow-lg hover:scale-105 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">replay</span>
                        <span>Xem lại</span>
                      </button>
                      <button
                        onClick={() => setShowRecommendations(false)}
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-all border border-white/10"
                        title="Đóng"
                      >
                        <span className="material-symbols-outlined text-base md:text-lg">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Lưới phim đề xuất */}
                  <div className="my-auto py-2">
                    {recommendedMovies.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
                        {recommendedMovies.map((movie) => {
                          const poster = movie.poster_url?.startsWith("http")
                            ? movie.poster_url
                            : `https://phimimg.com/${movie.poster_url || movie.thumb_url}`;
                          return (
                            <div
                              key={movie.slug}
                              onClick={() => {
                                setShowRecommendations(false);
                                saveToFirebase();
                                navigate(`/movie/${movie.slug}`);
                              }}
                              className="group/rec cursor-pointer flex flex-col"
                            >
                              <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden border border-white/10 group-hover/rec:border-white/80 transition-all duration-300 transform group-hover/rec:scale-105 shadow-lg">
                                <img
                                  src={poster}
                                  alt={movie.name}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover/rec:scale-110"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/rec:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform group-hover/rec:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                  </div>
                                </div>
                                {movie.quality && (
                                  <span className="absolute top-1 right-1 bg-black/80 backdrop-blur-md text-white text-[8px] md:text-[9px] font-semibold px-1.5 py-0.5 rounded">
                                    {movie.quality}
                                  </span>
                                )}
                                {movie.year && (
                                  <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-md text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    {movie.year}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-white text-[11px] md:text-xs lg:text-sm font-bold truncate mt-1.5 group-hover/rec:text-white transition-colors">
                                {movie.name}
                              </h4>
                              <p className="text-zinc-500 text-[9px] md:text-[10px] truncate">
                                {movie.origin_name || movie.time || "Phim"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-zinc-500">
                        <LoadingLogo className="w-8 h-8 mb-2" />
                        <span className="text-xs">Đang tìm các phim phù hợp...</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[11px] md:text-xs text-zinc-400 border-t border-white/10 pt-2.5">
                    <span>Chọn phim bất kỳ để xem chi tiết & phát</span>
                    <button
                      onClick={() => {
                        saveToFirebase();
                        navigate("/");
                      }}
                      className="hover:text-white transition-colors font-medium"
                    >
                      Về Trang Chủ →
                    </button>
                  </div>
                </div>
              )}

              {/* LỚP PHỦ MỜ KHI HIỆN CONTROLS VÀ VÙNG NHẬN SỰ KIỆN CLICK (TỐI ƯU CẢ PC VÀ MOBILE) */}
              <div 
                className={`absolute inset-0 bg-black/40 transition-opacity duration-300 z-10 flex items-center justify-center ${!isPlaying || showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={handlePlayerTap}
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
                  <div className={`-mt-6 flex items-center justify-center gap-6 transition-transform duration-300 md:mt-0 md:gap-12 ${!isPlaying || showControls ? 'scale-100' : 'scale-95'}`}>
                    {/* Lùi 10s: icon trắng to, nền tròn mờ chỉ hiện khi rê / chạm */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSkip(-10); handleUserActivity(); }}
                      className="flex size-12 items-center justify-center rounded-full text-[30px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-colors hover:bg-white/15 active:bg-white/25 md:size-16 md:text-[38px]"
                      aria-label="Lùi 10 giây"
                    >
                      <Back10Icon />
                    </button>

                    {/* Play / Pause: tròn kính mờ, icon tô đặc. Nổi nhất khung mà không loá như đĩa trắng đặc */}
                    <button
                      className="flex size-16 items-center justify-center rounded-full bg-black/45 text-[30px] text-white ring-1 ring-white/25 backdrop-blur-md transition-[transform,background-color] hover:scale-105 hover:bg-black/60 active:scale-95 md:size-20 md:text-[38px]"
                      onClick={(e) => { e.stopPropagation(); togglePlay(); handleUserActivity(); }}
                      aria-label={isPlaying ? "Tạm dừng" : "Phát"}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon className="translate-x-[2px]" />}
                    </button>

                    {/* Tiến 10s */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSkip(10); handleUserActivity(); }}
                      className="flex size-12 items-center justify-center rounded-full text-[30px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-colors hover:bg-white/15 active:bg-white/25 md:size-16 md:text-[38px]"
                      aria-label="Tới 10 giây"
                    >
                      <Fwd10Icon />
                    </button>
                  </div>
                )}

              </div>

              {/* PANEL CHỌN TẬP */}
              <div className={`absolute top-0 right-0 bottom-0 z-40 flex w-[80%] flex-col border-l border-white/10 bg-raised/95 transition-transform duration-300 ease-in-out supports-[backdrop-filter]:bg-raised/85 supports-[backdrop-filter]:backdrop-blur-xl sm:w-[340px] ${showEpisodes ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h3 className="text-base font-semibold text-white">Danh sách tập</h3>
                  <button onClick={() => setShowEpisodes(false)} className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Đóng danh sách tập">
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
                
                {/* SEASON SELECTOR IN PLAYER */}
                {relatedSeasons.length > 1 && (
                  <div className="p-4 border-b border-white/10">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Các phần & Movie</span>
                    <div className="flex flex-wrap gap-2">
                      {relatedSeasons.map(season => {
                        const isActive = season.id === currentSlug;
                        return (
                          <button 
                            key={season.id}
                            onClick={() => changeSeason(season.id)}
                            disabled={isLoadingSeason}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isActive ? 'bg-brand border-brand text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'} ${isLoadingSeason ? 'opacity-50' : 'opacity-100'}`}
                          >
                            {season.label || `Phần ${season.seasonNumber}`}
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
                  {currentEpisodes.map((ep, idx) => (
                    <button
                      key={`${ep.slug || ep.name}-${idx}`}
                      onClick={() => handleSwitchEpisode(ep)}
                      aria-current={ep.name === currentEpName ? "true" : undefined}
                      className={`flex h-11 w-full items-center justify-between rounded-xl px-4 text-sm transition-colors ${
                        ep.name === currentEpName
                          ? "bg-brand/15 font-medium text-white ring-1 ring-brand/50"
                          : "bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span>{renderEpisodeName(ep.name)}</span>
                      {ep.name === currentEpName && <span className="material-symbols-outlined text-[20px] text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>equalizer</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* BOTTOM BAR */}
              {/* LỖI MOBILE CŨ: khung này có pt-24 trong suốt nhưng vẫn "bắt" chạm, trên màn hình điện thoại (khung video cao ~210px)
                  nó phủ lên cả nút Play / Tua ở giữa -> bấm không ăn, video không phát được.
                  Giờ chính khung luôn pointer-events-none, chỉ các hàng điều khiển bên trong mới nhận chạm. */}
              <div className={`absolute bottom-0 left-0 right-0 pt-10 md:pt-24 pb-2 md:pb-4 px-3 md:px-6 bg-gradient-to-t from-black via-black/80 to-transparent z-30 transition-opacity duration-300 flex flex-col justify-end pointer-events-none ${showControls || !isPlaying ? 'opacity-100 [&>*]:pointer-events-auto' : 'opacity-0'}`}>
                
                {/* ĐÃ BỎ NÚT SKIP QUẢNG CÁO DO CÓ AUTO-SKIP */}

                <div 
                  ref={progressBarRef}
                  className="group/progress relative mb-2 flex h-1 w-full cursor-pointer items-center rounded-full bg-white/25 transition-[height] duration-200 hover:h-1.5 md:mb-3"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  <div className="absolute -inset-y-4 inset-x-0 bg-transparent z-10"></div> 
                  <div className="pointer-events-none relative h-full rounded-full bg-gradient-to-r from-brand to-accent-to" style={{ width: `${progressPercent}%` }}>
                    <div className={`absolute right-0 top-1/2 size-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-transform md:scale-0 md:group-hover/progress:scale-100 ${isDragging ? 'md:scale-100' : ''}`}></div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-0.5 md:gap-1">
                    <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className={CTRL} aria-label={isPlaying ? "Tạm dừng" : "Phát"} title={isPlaying ? "Tạm dừng (K)" : "Phát (K)"}>
                      {isPlaying ? <PauseIcon className="text-[22px]" /> : <PlayIcon className="text-[22px]" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSkip(-10); }} className={`${CTRL} hidden sm:flex`} aria-label="Lùi 10 giây" title="Lùi 10 giây (J)">
                      <Back10Icon className="text-[24px]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSkip(10); }} className={`${CTRL} hidden sm:flex`} aria-label="Tới 10 giây" title="Tới 10 giây (L)">
                      <Fwd10Icon className="text-[24px]" />
                    </button>

                    <div className="group/volume hidden items-center md:flex">
                      <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className={CTRL} aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"} title="Âm lượng (M)">
                        <VolumeIcon className="text-[24px]" muted={isMuted || volume === 0} level={volume} />
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={handleVolumeChange}
                        aria-label="Âm lượng"
                        className="h-1 w-0 cursor-pointer appearance-none overflow-hidden rounded-full bg-white/30 accent-white transition-all duration-300 group-hover/volume:mr-2 group-hover/volume:w-20"
                      />
                    </div>

                    <span className="ml-1.5 whitespace-nowrap text-xs tabular-nums text-white/80 md:ml-2 md:text-sm">
                      {formatTime(displayTime)} <span className="text-white/40">/ {formatTime(duration)}</span>
                    </span>
                  </div>

                  <div className="relative flex shrink-0 items-center gap-0.5 md:gap-1">
                    {currentAllServers?.length > 1 && (
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setShowLangMenu(!showLangMenu); setShowSettings(false); setShowEpisodes(false); }} className={`${CTRL} ${showLangMenu ? 'bg-white/15 text-white' : ''}`} aria-label="Phiên bản" title="Phiên bản (Vietsub / Thuyết minh)">
                          <SubtitlesIcon className="text-[24px]" />
                        </button>
                        {showLangMenu && (
                          <div className={MENU}>
                            <span className="px-3 pb-1.5 pt-1 text-xs text-white/50">Phiên bản</span>
                            {currentAllServers.map((server, index) => (
                              <button
                                key={index}
                                onClick={(e) => { e.stopPropagation(); handleSwitchLanguage(index); }}
                                className={`flex h-10 items-center justify-between rounded-lg px-3 text-left text-sm transition-colors ${activeServerIdx === index ? 'bg-white/10 font-medium text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                              >
                                {server.server_name}
                                {activeServerIdx === index && <span className="material-symbols-outlined text-[18px]">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={(e) => { e.stopPropagation(); setShowEpisodes(!showEpisodes); setShowSettings(false); setShowLangMenu(false); }} className={`${CTRL} ${showEpisodes ? 'bg-white/15 text-white' : ''}`} aria-label="Danh sách tập" title="Danh sách tập">
                      <EpisodesIcon className="text-[24px]" />
                    </button>

                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowEpisodes(false); setShowLangMenu(false); }} className={`${CTRL} ${showSettings ? 'bg-white/15 text-white' : ''}`} aria-label="Tốc độ phát" title="Tốc độ phát">
                        {playbackRate !== 1
                          ? <span className="text-sm font-semibold tabular-nums">{playbackRate}x</span>
                          : <SpeedIcon className="text-[24px]" />}
                      </button>
                      {showSettings && (
                        <div className={MENU}>
                          <span className="px-3 pb-1.5 pt-1 text-xs text-white/50">Tốc độ</span>
                          {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                            <button
                              key={rate}
                              onClick={(e) => { e.stopPropagation(); changeSpeed(rate); }}
                              className={`flex h-10 items-center justify-between rounded-lg px-3 text-left text-sm transition-colors ${playbackRate === rate ? 'bg-white/10 font-medium text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                            >
                              {rate === 1 ? 'Bình thường' : `${rate}x`}
                              {playbackRate === rate && <span className="material-symbols-outlined text-[18px]">check</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className={CTRL} aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"} title="Toàn màn hình (F)">
                      {isFullscreen ? <ExitFullscreenIcon className="text-[24px]" /> : <FullscreenIcon className="text-[24px]" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* THÔNG BÁO TỰ ĐỘNG BỎ QUA QUẢNG CÁO (KÈM NÚT HOÀN TÁC) */}
              {adNotice && (
                <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-2xl border border-white/60 text-white pl-4 pr-3 py-2 rounded-full flex items-center gap-3 text-xs md:text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] md:text-[20px] text-white animate-pulse">bolt</span>
                    <span>{typeof adNotice === 'object' ? adNotice.msg : adNotice}</span>
                  </div>
                  {typeof adNotice === 'object' && adNotice.canUndo && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleUndoSkip(); }}
                      className="bg-white hover:bg-white text-black px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold transition-all shadow-md active:scale-95 ml-1"
                      title="Quay lại đoạn vừa tua"
                    >
                      Hoàn tác
                    </button>
                  )}
                </div>
              )}

              {/* NÚT TẬP TIẾP THEO (ĐƯA RA NGOÀI ĐỂ KHÔNG BỊ BOTTOM BAR CHE MẤT, CHỈ HIỆN Ở 5 PHÚT CUỐI) */}
              {!isAutoNexting && nextEpisode && duration > 0 && (duration - currentTime <= 300) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleSwitchEpisode(nextEpisode); }} 
                  className={`absolute bottom-20 right-3 z-40 flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black transition-[opacity,transform] hover:scale-105 md:bottom-24 md:right-6 ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                >
                  <NextIcon className="text-[18px]" />
                  Tập tiếp theo
                </button>
              )}
            </>
          )}
        </div>

        {/* --- THANH "CONTROL CENTER" --- */}
        {/* Nguồn phát: chọn server chính (HLS) hay dự phòng (nhúng) */}
        <div className="relative z-10 mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between md:mt-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cat-2/15 text-cat-2" aria-hidden="true">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>dns</span>
            </span>
            <div>
              <p className="text-sm font-medium text-white">Nguồn phát: {useIframe ? "Dự phòng" : "Chính"}</p>
              <p className="text-xs text-white/55">Phim giật hoặc không chạy thì đổi nguồn khác.</p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => {
                // Không có link tương ứng thì đổi qua sẽ ra màn hình đen -> bỏ qua
                if (useIframe && !currentVideo) return;
                if (!useIframe && !currentEmbed) return;
                if (!useIframe) saveToFirebase();
                setUseIframe(!useIframe);
              }}
              disabled={(useIframe && !currentVideo) || (!useIframe && !currentEmbed)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-40 sm:w-auto"
            >
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              {useIframe ? "Đổi về nguồn chính" : "Đổi sang nguồn dự phòng"}
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
