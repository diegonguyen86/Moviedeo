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
  
  // Lấy dữ liệu truyền sang (Có thêm allServers)
  const { videoUrl, movieName, epName, allServers, currentServerIndex, posterUrl } = location.state || {};

  // Refs & States
  const playerRef = useRef(null);
  const [activeServerIdx, setActiveServerIdx] = useState(currentServerIndex || 0);
  const [currentVideo, setCurrentVideo] = useState(videoUrl);
  const [currentEpName, setCurrentEpName] = useState(epName);
  
  // Tracking Time States
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Lấy danh sách tập của Server hiện tại
  const currentEpisodes = allServers?.[activeServerIdx]?.server_data || [];

  // 1. TỰ ĐỘNG TÌM LẠI TIẾN ĐỘ ĐÃ XEM
  useEffect(() => {
    // Khóa cache gồm ID phim + Tên tập
    const savedTime = localStorage.getItem(`progress_${id}_${currentEpName}`);
    if (savedTime && playerRef.current && isReady) {
      playerRef.current.seekTo(parseFloat(savedTime), 'seconds');
    }
  }, [id, currentEpName, isReady]);

  // 2. LƯU LỊCH SỬ LÊN FIREBASE (Lưu khi Đổi tập / Tạm dừng để tránh spam DB)
  const saveToFirebase = async () => {
    if (!user || !movieName || !currentVideo) return;
    try {
      const historyRef = doc(db, "users", user.uid, "watchHistory", id);
      await setDoc(historyRef, {
        slug: id,
        movieId: id,
        title: movieName,
        epName: currentEpName,
        image: posterUrl,
        progress: playedSeconds, // Lưu lại số giây đã xem
        lastWatched: serverTimestamp() 
      });
      console.log("✅ Đã đồng bộ tiến độ lên Firebase!");
    } catch (error) {
      console.error("❌ Lỗi lưu lịch sử:", error);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    saveToFirebase(); // Lưu ngay khi vừa load vào tập
  }, [currentVideo]);

  if (!videoUrl) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
      <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
      <p className="text-xl font-bold">Không tìm thấy link video m3u8!</p>
      <button onClick={() => navigate(-1)} className="mt-6 bg-primary px-8 py-3 rounded-xl font-bold text-white">Quay lại</button>
    </div>
  );

  // Hàm chuyển tập
  const handleSwitchEpisode = (ep) => {
    saveToFirebase(); // Đồng bộ Firebase trước khi đổi tập
    setCurrentVideo(ep.link_m3u8 || ep.link_embed); 
    setCurrentEpName(ep.name);
    setIsReady(false); // Reset trạng thái để nó tự tua lại từ đầu ở tập mới
  };

  // Hàm chuyển Server
  const handleSwitchServer = (idx) => {
    setActiveServerIdx(idx);
    const newServerEpisodes = allServers[idx].server_data;
    // Cố gắng tìm tập tương đương ở Server mới
    const equivalentEp = newServerEpisodes.find(e => e.name === currentEpName) || newServerEpisodes[0];
    
    setCurrentVideo(equivalentEp.link_m3u8 || equivalentEp.link_embed);
    setCurrentEpName(equivalentEp.name);
    setIsReady(false);
  };

  const currentIndex = currentEpisodes.findIndex(e => (e.link_m3u8 || e.link_embed) === currentVideo);
  const nextEpisode = currentIndex < currentEpisodes.length - 1 ? currentEpisodes[currentIndex + 1] : null;

  return (
    <main className="relative min-h-screen bg-black text-white pt-24 pb-20 overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <img src={posterUrl} alt="Background" className="w-full h-full object-cover opacity-25 blur-[80px] scale-150" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-4 md:px-8">
        
        {/* KHUNG PHÁT VIDEO CHUYÊN NGHIỆP */}
        <div className="relative w-full aspect-video bg-black rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] border border-white/10">
          <ReactPlayer
            ref={playerRef}
            url={currentVideo}
            controls={true}
            width="100%"
            height="100%"
            playing={true}
            style={{ position: 'absolute', top: 0, left: 0 }}
            onReady={() => setIsReady(true)}
            // BẮT SỰ KIỆN LƯU THỜI GIAN THEO TỪNG GIÂY VÀO LOCALSTORAGE
            onProgress={(progress) => {
              setPlayedSeconds(progress.playedSeconds);
              localStorage.setItem(`progress_${id}_${currentEpName}`, progress.playedSeconds);
            }}
            onPause={saveToFirebase} // Khi user bấm tạm dừng -> Đẩy dữ liệu lên Firebase
            config={{
              file: {
                forceHLS: true,
                attributes: { poster: posterUrl }
              }
            }}
          />
        </div>

        <div className="mt-12 flex flex-col md:flex-row md:items-end justify-between gap-10 pb-12 border-b border-white/10">
          <div className="space-y-5">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight drop-shadow-lg">{movieName}</h1>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-primary font-black bg-primary/20 px-5 py-2 rounded-2xl border border-primary/30 text-sm tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                Tập {currentEpName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => { saveToFirebase(); navigate(-1); }} className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-[1.5rem] font-black transition-all border border-white/10 active:scale-90">
              <span className="material-symbols-outlined text-3xl">arrow_back</span> QUAY LẠI
            </button>
            {nextEpisode && (
              <button onClick={() => handleSwitchEpisode(nextEpisode)} className="flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-5 bg-primary hover:bg-primary-fixed text-white rounded-[1.5rem] font-black transition-all shadow-[0_20px_40px_rgba(var(--primary-rgb),0.4)] hover:-translate-y-1 active:scale-95">
                TẬP TIẾP THEO <span className="material-symbols-outlined text-3xl">skip_next</span>
              </button>
            )}
          </div>
        </div>

        {/* CHỌN SERVER & TẬP */}
        <div className="mt-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-1.5 h-10 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]"></div>
            <h3 className="text-3xl font-black uppercase tracking-tighter">Danh sách tập</h3>
          </div>

          {allServers && allServers.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-black/50 rounded-xl w-fit border border-white/5">
              {allServers.map((server, index) => (
                <button
                  key={index}
                  onClick={() => handleSwitchServer(index)}
                  className={`px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
                    activeServerIdx === index ? "bg-primary text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {server.server_name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-5">
            {currentEpisodes.map((ep) => {
              const isSelected = ep.name === currentEpName;
              return (
                <button
                  key={ep.slug}
                  onClick={() => handleSwitchEpisode(ep)}
                  className={`min-w-[85px] h-16 px-6 flex items-center justify-center rounded-[1.2rem] font-black transition-all duration-300 border-2 text-xl ${
                    isSelected ? "bg-primary border-primary text-white shadow-[0_0_30px_rgba(var(--primary-rgb),0.6)] scale-110 z-10" : "bg-white/5 border-white/5 text-zinc-500 hover:border-primary/50 hover:text-white hover:scale-105"
                  }`}
                >
                  {ep.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}