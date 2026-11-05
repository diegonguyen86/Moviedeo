import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js"; 
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp, increment } from "firebase/firestore";
import LoadingLogo from "../components/LoadingLogo";
import CommentSection from "../components/CommentSection";
import { apiGetRelatedSeasons, apiGetPhimDetail, apiGetPhimTheoTheLoai } from "../api/api";

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

  // SIÊU THUẬT TOÁN NHẬN DIỆN & TỰ ĐỘNG BỎ QUA QUẢNG CÁO (ULTRA-LOW LATENCY < 0.25s)
  const scanCanvasRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const lastSkippedTimeRef = useRef(0);
  const canScanAdRef = useRef(true);
  const adConfirmationStreakRef = useRef(0);
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
            setCurrentPosterUrl(
              res.movie.poster_url?.startsWith("http")
                ? res.movie.poster_url
                : `https://phimimg.com/${res.movie.poster_url}`
            );
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
      const currentProgress = videoRef.current?.currentTime || currentTime;
      
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
      } else {
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
    const video = videoRef.current;
    if (!video) return;
    const current = video.currentTime;
    video.currentTime = current + AD_DURATION_SECONDS;
    lastSkippedTimeRef.current = video.currentTime;
    adConfirmationStreakRef.current = 0;
    showAdNotice(
      reason === "auto" 
        ? "⚡ Đã tự động nhận diện & bỏ qua 30s quảng cáo" 
        : "⏩ Đã bỏ qua 30s quảng cáo", 
      true
    );
  };

  // NHẬN DIỆN QUẢNG CÁO ĐA VÙNG, ĐA MÀU SẮC SIÊU TỐC (< 0.25 GIÂY)
  const detectAdAndSkip = () => {
    const video = videoRef.current;
    if (!video || !canScanAdRef.current || video.paused || video.ended) return;

    const current = video.currentTime;

    // Cooldown 45 giây sau khi vừa skip (cho phép nhận diện nhiều quảng cáo trong cùng 1 tập)
    if (Math.abs(current - lastSkippedTimeRef.current) < 45) return;

    // Khung giờ vàng xuất hiện quảng cáo cờ bạc ở web phim lậu:
    // 1. Đoạn đầu phim: 0s - 90s
    // 2. Đoạn giữa 1: 600s - 1300s (10:00 - 21:40)
    // 3. Đoạn giữa 2: 2400s - 3600s (40:00 - 60:00)
    const isAdWindow = (current <= 90) || (current >= 600 && current <= 1300) || (current >= 2400 && current <= 3600);
    if (!isAdWindow) {
      adConfirmationStreakRef.current = 0;
      return;
    }

    // TỐI ƯU ĐỘ TRỄ: Quét 5 lần/giây (mỗi 180ms) thay vì 1500ms như trước
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - lastScanTimeRef.current < 180) return;
    lastScanTimeRef.current = now;

    try {
      if (!scanCanvasRef.current) {
        const c = document.createElement("canvas");
        c.width = 48; // 48 x 27 pixels (Tỷ lệ 16:9, tổng chỉ 1296 pixels - cực nhẹ, quét mất < 0.1ms CPU)
        c.height = 27;
        scanCanvasRef.current = c;
      }
      const canvas = scanCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !video.videoWidth || !video.videoHeight) return;

      // Vẽ toàn bộ khung hình tỉ lệ chuẩn vào canvas 48x27 (Chỉ tốn ~0.08ms CPU)
      ctx.drawImage(video, 0, 0, 48, 27);
      const imgData = ctx.getImageData(0, 0, 48, 27);
      const data = imgData.data;

      let adScore = 0;
      let bannerAdScore = 0;
      let bannerPixelCount = 0;
      const totalPixels = 48 * 27;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        const pixelIdx = i / 4;
        const y = Math.floor(pixelIdx / 48);
        const isBannerZone = (y >= 18); // 30% đáy màn hình (nơi chứa banner/logo/chữ cờ bạc)

        if (isBannerZone) bannerPixelCount++;

        // 1. Đỏ tươi cờ bạc (Bet88, Jun88, Shbet...)
        const isBrightRed = (r > 130 && r > g * 1.8 && r > b * 1.8);

        // 2. Vàng tươi / Cam rực (Logo nạp rút, link website, 789bet, Okvip)
        const isBrightYellow = (r > 165 && g > 135 && b < 70 && (r + g) > 310);

        // 3. Xanh lá neon nhà cái (FB88, Kubet)
        const isNeonGreen = (g > 140 && g > r * 1.5 && g > b * 1.5);

        // 4. Xanh Cyan / Xanh dương rực (1xBet)
        const is1xBetBlue = (b > 150 && b > r * 1.5 && g > 75);

        if (isBrightRed || isBrightYellow || isNeonGreen || is1xBetBlue) {
          adScore++;
          if (isBannerZone) bannerAdScore++;
        }
      }

      const totalRatio = adScore / totalPixels;
      const bannerRatio = bannerPixelCount > 0 ? (bannerAdScore / bannerPixelCount) : 0;

      // Nhận diện trúng: Banner đáy có > 13% pixel nhà cái HOẶC toàn màn hình có > 11% pixel nhà cái
      const isDetected = (bannerRatio > 0.13) || (totalRatio > 0.11);

      if (isDetected) {
        adConfirmationStreakRef.current += 1;
        // Cần 2 lần quét liên tiếp xác nhận trúng (~360ms) để không bị false positive khi xem cảnh cháy nổ
        if (adConfirmationStreakRef.current >= 2) {
          handleSkipAd("auto");
        }
      } else {
        adConfirmationStreakRef.current = 0;
      }
    } catch (e) {
      if (e.name === "SecurityError" || e.message?.includes("tainted")) {
        // Tự động dừng quét nếu canvas bị tainted do chính sách CORS của CDN
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

      // Nhận diện tự động siêu tốc trong các khung giờ quảng cáo
      detectAdAndSkip();
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
    lastSkippedTimeRef.current = 0; // Reset mốc skip khi chuyển tập
    adConfirmationStreakRef.current = 0;
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

  const displayTime = isDragging ? seekTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <main className="relative min-h-screen bg-[#050505] text-white pt-6 md:pt-12 pb-20 font-sans overflow-hidden select-none">
      
      {/* AMBIENT ÁNH SÁNG */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 md:opacity-40 blur-2xl md:blur-[100px] scale-105 md:scale-110 saturate-150 transition-all duration-1000 transform-gpu will-change-transform" 
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
                webkit-playsinline="true"
                x5-playsinline="true"
                preload="auto"
                crossOrigin="anonymous"
                poster={currentPosterUrl}
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

                            {/* HIỆU ỨNG BUFFERING KHI MẠNG MOBILE CHẬM */}
              {isBuffering && isPlaying && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 bg-black/30 backdrop-blur-[2px]">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-yellow-500/20 border-t-yellow-500 animate-spin shadow-[0_0_20px_rgba(234,179,8,0.5)]"></div>
                  <span className="text-[11px] font-bold text-yellow-400/80 mt-2 tracking-widest uppercase">Đang tải...</span>
                </div>
              )}

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

              {/* MÀN HÌNH ĐỀ XUẤT PHIM CÙNG THỂ LOẠI (KHI HẾT PHIM / TẬP CUỐI) */}
              {showRecommendations && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-40 flex flex-col justify-between p-4 md:p-6 lg:p-8 animate-in fade-in duration-300 pointer-events-auto">
                  {/* Header đề xuất */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-yellow-400 text-xs md:text-sm font-black uppercase tracking-wider mb-1">
                        <span className="material-symbols-outlined text-base md:text-lg">auto_awesome</span>
                        <span>Đề xuất tiếp theo</span>
                      </div>
                      <h3 className="text-base md:text-xl lg:text-2xl font-black text-white uppercase tracking-tight">
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
                              <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden border border-white/10 group-hover/rec:border-yellow-500/80 transition-all duration-300 transform group-hover/rec:scale-105 shadow-lg group-hover/rec:shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                                <img
                                  src={poster}
                                  alt={movie.name}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover/rec:scale-110"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/rec:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center shadow-lg transform group-hover/rec:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                  </div>
                                </div>
                                {movie.quality && (
                                  <span className="absolute top-1 right-1 bg-black/80 backdrop-blur-md text-yellow-400 text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded">
                                    {movie.quality}
                                  </span>
                                )}
                                {movie.year && (
                                  <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-md text-white text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    {movie.year}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-white text-[11px] md:text-xs lg:text-sm font-bold truncate mt-1.5 group-hover/rec:text-yellow-400 transition-colors">
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
                      className="hover:text-yellow-400 transition-colors font-medium"
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
                  <div className={`flex items-center justify-center gap-6 md:gap-20 transition-transform duration-300 ${!isPlaying || showControls ? 'scale-100' : 'scale-90'}`}>
                    
                    {/* Lùi 10s */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSkip(-10); handleUserActivity(); }} 
                      className="text-white hover:text-yellow-400 hover:scale-110 transition-all drop-shadow-lg p-2 md:p-4"
                    >
                      <span className="material-symbols-outlined text-4xl md:text-[48px]">replay_10</span>
                    </button>

                    {/* Play/Pause */}
                    <div className="flex flex-col items-center">
                      <button 
                        className="relative w-16 h-16 md:w-20 md:h-20 bg-white/10 border border-white/40 text-white rounded-full flex items-center justify-center backdrop-blur-xl hover:bg-white hover:text-black hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] group/play"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay();
                          handleUserActivity();
                        }}
                      >
                        {!isPlaying && <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-yellow-400 group-hover/play:bg-black"></div>}
                        <span className="material-symbols-outlined text-4xl md:text-5xl drop-shadow-md z-10" style={{ fontVariationSettings: "'FILL' 1", marginLeft: isPlaying ? '0' : '4px' }}>
                          {isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                      {!isPlaying && (
                        <span className="md:hidden text-[10px] font-black text-yellow-400 bg-black/80 border border-yellow-500/40 px-2.5 py-0.5 rounded-full mt-2 tracking-wider uppercase shadow-md animate-pulse">
                          Chạm để phát
                        </span>
                      )}
                    </div>

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
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Các phần & Movie</span>
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
                
                {/* ĐÃ BỎ NÚT SKIP QUẢNG CÁO DO CÓ AUTO-SKIP */}

                <div 
                  ref={progressBarRef}
                  className="w-full h-1 md:h-1 hover:h-2 md:hover:h-2 bg-white/20 rounded-full cursor-pointer relative group/progress mb-3 md:mb-5 flex items-center transition-all duration-200" 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
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
                      {formatTime(displayTime)} <span className="mx-0.5 text-white/40">/</span> {formatTime(duration)}
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

              {/* THÔNG BÁO TỰ ĐỘNG BỎ QUA QUẢNG CÁO (KÈM NÚT HOÀN TÁC) */}
              {adNotice && (
                <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-2xl border border-yellow-500/60 text-yellow-400 pl-4 pr-3 py-2 rounded-full shadow-[0_0_30px_rgba(234,179,8,0.4)] flex items-center gap-3 text-xs md:text-sm font-black animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] md:text-[20px] text-yellow-400 animate-pulse">bolt</span>
                    <span>{typeof adNotice === 'object' ? adNotice.msg : adNotice}</span>
                  </div>
                  {typeof adNotice === 'object' && adNotice.canUndo && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleUndoSkip(); }}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold transition-all shadow-md active:scale-95 ml-1"
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
