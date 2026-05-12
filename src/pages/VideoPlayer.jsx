import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function VideoPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  const { user } = useAuth();
  
  const { embedUrl, movieName, epName, allEpisodes, posterUrl } = location.state || {};

  const [currentEmbed, setCurrentEmbed] = useState(embedUrl);
  const [currentEpName, setCurrentEpName] = useState(epName);

  // XÓA BỎ ÉP HTTPS ĐỂ LINK HTTP GỐC ĐƯỢC CHẠY BÌNH THƯỜNG
  // const secureEmbed = currentEmbed?.replace("http://", "https://");

  useEffect(() => {
    if (user && movieName && currentEmbed) {
      const saveToFirebase = async () => {
        try {
          const historyRef = doc(db, "users", user.uid, "watchHistory", id);
          await setDoc(historyRef, {
            slug: id,
            movieId: id,
            title: movieName,
            epName: currentEpName,
            image: posterUrl,
            lastWatched: serverTimestamp() 
          });
          console.log("✅ Đã lưu lịch sử xem phim!");
        } catch (error) {
          console.error("❌ Lỗi lưu lịch sử:", error);
        }
      };
      saveToFirebase();
    }
  }, [currentEmbed, user, movieName, currentEpName, posterUrl, id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentEmbed]);

  if (!embedUrl) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
      <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
      <p className="text-xl font-bold">Không tìm thấy link phim rồi bạn ơi!</p>
      <button onClick={() => navigate(-1)} className="mt-6 bg-primary px-8 py-3 rounded-xl font-bold text-white">Quay lại</button>
    </div>
  );

  const handleSwitchEpisode = (ep) => {
    setCurrentEmbed(ep.embed);
    setCurrentEpName(ep.name);
  };

  const currentIndex = allEpisodes?.findIndex(e => e.embed === currentEmbed);
  const nextEpisode = allEpisodes && currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

  return (
    <main className="relative min-h-screen bg-black text-white pt-24 pb-20 overflow-hidden font-sans">
      {/* Background Blur */}
      <div className="absolute inset-0 z-0">
        <img 
          src={posterUrl} 
          alt="Background" 
          className="w-full h-full object-cover opacity-25 blur-[80px] scale-150"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1260px] mx-auto px-4 md:px-8">
        
        {/* KHUNG PHÁT VIDEO - TRẢ VỀ NGUYÊN BẢN */}
        <div className="relative w-full aspect-video bg-black rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] border border-white/10">
          <iframe
            src={currentEmbed} // Dùng thẳng link gốc của API
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            title={movieName}
            // Đã xóa sạch sandbox và referrerPolicy để không bị vướng
          />
        </div>

        {/* 🆘 NÚT PHAO CỨU SINH CHO SAFARI Ở ĐÂY */}
        <div className="mt-6 flex justify-center">
          <a 
            href={currentEmbed} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-8 py-4 bg-red-600 animate-pulse hover:bg-red-700 hover:animate-none text-white font-black rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center gap-3 transition-all active:scale-95 text-lg"
          >
            <span className="material-symbols-outlined text-3xl">play_circle</span>
            MỞ TRÌNH PHÁT TRỰC TIẾP TRÊN SAFARI
          </a>
        </div>

        {/* Thông tin phim */}
        <div className="mt-8 flex flex-col md:flex-row md:items-end justify-between gap-10 pb-12 border-b border-white/10">
          <div className="space-y-5">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight drop-shadow-lg">
              {movieName}
            </h1>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-primary font-black bg-primary/20 px-5 py-2 rounded-2xl border border-primary/30 text-sm tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                Tập {currentEpName}
              </span>
            </div>
          </div>

          {/* Điều hướng tập */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => navigate(-1)}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-[1.5rem] font-black transition-all border border-white/10 active:scale-90"
            >
              <span className="material-symbols-outlined text-3xl">arrow_back</span>
              QUAY LẠI
            </button>

            {nextEpisode && (
              <button 
                onClick={() => handleSwitchEpisode(nextEpisode)}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-5 bg-primary hover:bg-primary-fixed text-white rounded-[1.5rem] font-black transition-all shadow-[0_20px_40px_rgba(var(--primary-rgb),0.4)] hover:-translate-y-1 active:scale-95"
              >
                TẬP TIẾP THEO
                <span className="material-symbols-outlined text-3xl">skip_next</span>
              </button>
            )}
          </div>
        </div>

        {/* Danh sách tập */}
        <div className="mt-16">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-1.5 h-10 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]"></div>
            <h3 className="text-3xl font-black uppercase tracking-tighter">Danh sách tập</h3>
          </div>

          <div className="flex flex-wrap gap-5">
            {allEpisodes?.map((ep) => {
              const isSelected = ep.embed === currentEmbed;
              return (
                <button
                  key={ep.slug}
                  onClick={() => handleSwitchEpisode(ep)}
                  className={`min-w-[85px] h-16 px-6 flex items-center justify-center rounded-[1.2rem] font-black transition-all duration-300 border-2 text-xl ${
                    isSelected 
                    ? "bg-primary border-primary text-white shadow-[0_0_30px_rgba(var(--primary-rgb),0.6)] scale-110 z-10" 
                    : "bg-white/5 border-white/5 text-zinc-500 hover:border-primary/50 hover:text-white hover:scale-105"
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