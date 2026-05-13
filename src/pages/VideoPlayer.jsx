import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js"; // 🔥 IMPORT ĐỘNG CƠ MỚI
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const { user } = useAuth();
  
  const { videoUrl, embedFallback, movieName, epName, allServers, currentServerIndex, posterUrl } = location.state || {};

  const videoRef = useRef(null); // Trỏ trực tiếp vào thẻ <video> HTML5
  const [activeServerIdx, setActiveServerIdx] = useState(currentServerIndex || 0);
  const [currentVideo, setCurrentVideo] = useState(videoUrl);
  const [currentEmbed, setCurrentEmbed] = useState(embedFallback);
  const [currentEpName, setCurrentEpName] = useState(epName);
  
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [useIframe, setUseIframe] = useState(false);

  // Bắt lỗi F5
  useEffect(() => {
    if (!videoUrl && !embedFallback) {
      navigate(`/movie/${id}`, { replace: true });
    }
  }, [videoUrl, embedFallback, id, navigate]);

  const rawEpisodes = allServers?.[activeServerIdx]?.server_data || allServers?.[activeServerIdx]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  // LƯU TIẾN ĐỘ THÔNG MINH
  const saveToFirebase = async () => {
    if (!user || !movieName) return;
    try {
      const historyRef = doc(db, "users", user.uid, "watchHistory", id);
      await setDoc(historyRef, {
        slug: id, 
        movieId: id, 
        title: movieName, 
        epName: currentEpName,
        image: posterUrl, 
        progress: playedSeconds, // Vẫn lưu giây để tua cho chính xác từng khung hình
        lastWatched: serverTimestamp() 
      });
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    saveToFirebase();
  }, [currentVideo, useIframe]);

  // 🚀 LOGIC TRÌNH PHÁT NATIVE XỊN XÒ TỰ BUILD
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useIframe || !currentVideo) return;

    let hls;
    const safeVideoUrl = currentVideo.replace("http://", "https://");

    // Lấy tiến độ đã xem từ LocalStorage
    const savedTime = localStorage.getItem(`progress_${id}_${currentEpName}`);

    // TRƯỜNG HỢP 1: Chạy trên Edge/Chrome/PC (Cần HLS.js)
    if (Hls.isSupported()) {
      hls = new Hls({
        debug: false, // Bật thành true nếu ông giáo muốn soi lỗi trong console
        enableWorker: true,
      });

      hls.loadSource(safeVideoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (savedTime) video.currentTime = parseFloat(savedTime);
        video.play().catch(e => console.warn("Chặn Autoplay, hãy bấm tay vào màn hình"));
      });

      // BẮT LỖI TỬ HUYỆT (403/CORS) SIÊU NHẠY
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.warn("⚠️ HLS.js tử trận (Lỗi mạng/CORS), xoay Iframe thôi!");
          setUseIframe(true);
          hls.destroy();
        }
      });
    } 
    // TRƯỜNG HỢP 2: Chạy trên Safari/iOS (Hỗ trợ Native m3u8 cực mượt)
    else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = safeVideoUrl;
      video.addEventListener("loadedmetadata", () => {
        if (savedTime) video.currentTime = parseFloat(savedTime);
        video.play().catch(e => console.warn("Chặn Autoplay"));
      });
      video.addEventListener("error", () => {
        console.warn("⚠️ Safari Native tịt ngòi, xoay Iframe!");
        setUseIframe(true);
      });
    }

    // Lắng nghe thời gian chạy để lưu trữ
    const updateTime = () => {
      setPlayedSeconds(video.currentTime);
      localStorage.setItem(`progress_${id}_${currentEpName}`, video.currentTime);
    };
    video.addEventListener("timeupdate", updateTime);

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener("timeupdate", updateTime);
    };
  }, [currentVideo, useIframe, currentEpName, id]);


  const handleSwitchEpisode = (ep) => {
    saveToFirebase();
    setCurrentVideo(ep.link_m3u8 || ep.m3u8 || ""); 
    setCurrentEmbed(ep.link_embed || ep.embed || "");
    setCurrentEpName(ep.name);
    setUseIframe(false); // Ưu tiên m3u8 trước
  };

  const handleSwitchServer = (idx) => {
    setActiveServerIdx(idx);
    const newServerEpisodes = allServers[idx].server_data || allServers[idx].items || [];
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    handleSwitchEpisode(equivalentEp);
  };

  const currentIndex = currentEpisodes.findIndex(e => e.name === currentEpName);
  const nextEpisode = currentIndex < currentEpisodes.length - 1 ? currentEpisodes[currentIndex + 1] : null;

  if (!currentVideo && !currentEmbed) return null; 

  const renderEpisodeName = (name) => {
    if (!name) return "";
    const cleanName = name.replace(/tập/gi, "").trim();
    return `Tập ${cleanName}`;
  };

  // Tính thời gian ra phút cho đẹp giao diện
  const minutesWatched = Math.floor(playedSeconds / 60);

  return (
    <main className="relative min-h-screen bg-black text-white pt-24 pb-20 font-sans overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={posterUrl} alt="Bg" className="w-full h-full object-cover opacity-20 blur-[100px] scale-150" />
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-4">
        {/* KHUNG PHÁT VIDEO CHUẨN HTML5 */}
        <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
          {useIframe ? (
            <iframe src={currentEmbed} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <video
              ref={videoRef}
              controls
              playsInline
              poster={posterUrl}
              className="absolute inset-0 w-full h-full bg-black outline-none"
              onPause={saveToFirebase}
            />
          )}
        </div>

        <div className="mt-12 flex flex-col md:flex-row justify-between gap-6 pb-8 border-b border-white/10">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">{movieName}</h1>
            <div className="flex gap-3 items-center">
               <span className="bg-primary/20 text-primary px-4 py-1.5 rounded-xl border border-primary/30 text-sm font-bold uppercase tracking-widest">
                {renderEpisodeName(currentEpName)}
              </span>
              <span className="text-zinc-500 text-sm font-bold">
                Đã xem: {minutesWatched} phút
              </span>
              {!useIframe && (
                <button onClick={() => setUseIframe(true)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-colors">
                  🔄 Bật Server Embed (Nếu giật lag)
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate(-1)} className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black">QUAY LẠI</button>
            {nextEpisode && (
              <button onClick={() => handleSwitchEpisode(nextEpisode)} className="px-8 py-4 bg-primary hover:bg-primary-fixed rounded-2xl font-black text-white transition-all">TẬP TIẾP THEO</button>
            )}
          </div>
        </div>

        <div className="mt-12">
          <h3 className="text-2xl font-black uppercase mb-6 tracking-tighter">Chọn tập khác</h3>
          {allServers?.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-black/50 rounded-xl w-fit border border-white/5">
              {allServers.map((server, index) => (
                <button key={index} onClick={() => handleSwitchServer(index)}
                  className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${activeServerIdx === index ? "bg-primary text-white" : "text-zinc-500 hover:text-white"}`}
                >
                  {server.server_name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            {currentEpisodes.map((ep) => (
              <button key={ep.slug} onClick={() => handleSwitchEpisode(ep)}
                className={`min-w-[70px] h-14 px-5 flex items-center justify-center rounded-2xl font-black transition-all border-2 ${
                  ep.name === currentEpName ? "bg-primary border-primary text-white scale-110 shadow-lg" : "bg-white/5 border-white/5 text-zinc-500 hover:text-white"
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