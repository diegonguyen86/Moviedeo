import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const { user } = useAuth();
  
  const { videoUrl, embedFallback, movieName, epName, allServers, currentServerIndex, posterUrl } = location.state || {};

  const playerRef = useRef(null);
  const [activeServerIdx, setActiveServerIdx] = useState(currentServerIndex || 0);
  const [currentVideo, setCurrentVideo] = useState(videoUrl);
  const [currentEmbed, setCurrentEmbed] = useState(embedFallback);
  const [currentEpName, setCurrentEpName] = useState(epName);
  
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [useIframe, setUseIframe] = useState(false);

  // 🛡️ NHẬN DIỆN THIẾT BỊ APPLE ĐỂ TỐI ƯU TRÌNH PHÁT VÀ FIX MÀN HÌNH ĐEN
  const isAppleDevice = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // BẮT LỖI TỐI THƯỢNG: Tránh F5 bay mất phim
  useEffect(() => {
    if (!videoUrl && !embedFallback) {
      navigate(`/movie/${id}`, { replace: true });
    }
  }, [videoUrl, embedFallback, id, navigate]);

  // Hỗ trợ mảng 2 chuẩn
  const rawEpisodes = allServers?.[activeServerIdx]?.server_data || allServers?.[activeServerIdx]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  const saveToFirebase = async () => {
    if (!user || !movieName) return;
    try {
      const historyRef = doc(db, "users", user.uid, "watchHistory", id);
      await setDoc(historyRef, {
        slug: id, movieId: id, title: movieName, epName: currentEpName,
        image: posterUrl, progress: playedSeconds, lastWatched: serverTimestamp() 
      });
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    saveToFirebase();
  }, [currentVideo, useIframe]);

  useEffect(() => {
    const savedTime = localStorage.getItem(`progress_${id}_${currentEpName}`);
    if (savedTime && playerRef.current && isReady && !useIframe) {
      playerRef.current.seekTo(parseFloat(savedTime), 'seconds');
    }
  }, [id, currentEpName, isReady, useIframe]);

  const handleSwitchEpisode = (ep) => {
    saveToFirebase();
    setCurrentVideo(ep.link_m3u8 || ep.m3u8 || ""); 
    setCurrentEmbed(ep.link_embed || ep.embed || "");
    setCurrentEpName(ep.name);
    setIsReady(false);
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

  if (!currentVideo && !currentEmbed) return null; // Ẩn lỗi nhấp nháy khi bị F5

  // Hàm xử lý chữ "Tập" bị lặp (Fix lỗi "Tập Tập 01")
  const renderEpisodeName = (name) => {
    if (!name) return "";
    return name.toLowerCase().includes("tập") ? name : `Tập ${name}`;
  };

  return (
    // THÊM overflow-hidden Ở ĐÂY ĐỂ FIX LỖI MOBILE BỊ THANH CUỘN NGANG
    <main className="relative min-h-screen bg-black text-white pt-24 pb-20 font-sans overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={posterUrl} alt="Bg" className="w-full h-full object-cover opacity-20 blur-[100px] scale-150" />
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-4">
        <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group">
          {useIframe ? (
            <iframe src={currentEmbed} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen allow="autoplay" />
          ) : (
            <ReactPlayer
              ref={playerRef} 
              // ÉP HTTPS ĐỂ TRÁNH SAFARI CHẶN MIXED CONTENT
              url={currentVideo ? currentVideo.replace("http://", "https://") : ""} 
              controls width="100%" height="100%" playing={true}
              style={{ position: 'absolute', top: 0, left: 0 }}
              onReady={() => setIsReady(true)}
              onProgress={(p) => {
                setPlayedSeconds(p.playedSeconds);
                localStorage.setItem(`progress_${id}_${currentEpName}`, p.playedSeconds);
              }}
              onPause={saveToFirebase}
              onError={() => {
                console.warn("⚠️ M3U8 bị chặn, bật Iframe dự phòng!");
                setUseIframe(true);
              }}
              
              // 👇 BỘ ĐÔI FIX MÀN HÌNH ĐEN SAFARI (HIỆN ẢNH BÌA VÀ NÚT PLAY) 👇
              light={posterUrl}
              playIcon={
                <div className="w-20 h-20 md:w-24 md:h-24 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-[0_0_40px_rgba(var(--primary-rgb),0.8)] z-50 animate-pulse group-hover:animate-none">
                  <span className="material-symbols-outlined text-6xl ml-2">play_arrow</span>
                </div>
              }

              // EDGE DÙNG HLS, APPLE DÙNG NATIVE
              config={{ 
                file: { 
                  forceHLS: !isAppleDevice,
                  attributes: { playsInline: true } 
                } 
              }}
            />
          )}
        </div>

        <div className="mt-12 flex flex-col md:flex-row justify-between gap-6 pb-8 border-b border-white/10">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">{movieName}</h1>
            <div className="flex gap-3">
               <span className="bg-primary/20 text-primary px-4 py-1.5 rounded-xl border border-primary/30 text-sm font-bold uppercase tracking-widest">
                {renderEpisodeName(currentEpName)}
              </span>
              {!useIframe && (
                <button onClick={() => setUseIframe(true)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-colors">
                  🔄 Đổi Server dự phòng
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate(-1)} className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black">QUAY LẠI</button>
            {nextEpisode && (
              <button onClick={() => handleSwitchEpisode(nextEpisode)} className="px-8 py-4 bg-primary rounded-2xl font-black">TẬP TIẾP THEO</button>
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