import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDocs 
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { apiGetPhimDetail } from "../api/api"; 
import LoadingLogo from "../components/LoadingLogo"; 
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import { Link } from "react-router-dom";

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState(null); 
  const navigate = useNavigate();
  const { watchlist, removeFromWatchlist } = useWatchlist();
  const { showConfirm, showToast } = useNotification();

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "users", user.uid, "watchHistory"),
        orderBy("lastWatched", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          docId: doc.id, 
          id: doc.data().slug || doc.id, 
          title: doc.data().title,
          image: doc.data().image,
          // 👇 FIX TRỊ BỆNH LẶP CHỮ TẬP TẠI ĐÂY: Dữ liệu thô truyền thẳng, không nhét chữ linh tinh vào
          year: doc.data().epName || "Đang cập nhật",
          rawEpName: doc.data().epName,
          progress: doc.data().progress
        }));
        setHistory(data);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const deleteOneHistory = async (e, docId) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    showConfirm("Xóa phim này khỏi lịch sử?", async () => {
      try {
        await deleteDoc(doc(db, "users", user.uid, "watchHistory", docId));
        showToast("Đã xóa khỏi lịch sử", "success");
      } catch (error) {
        console.error("Lỗi xóa phim:", error);
        showToast("Lỗi khi xóa phim", "error");
      }
    });
  };

  const clearAllHistory = async () => {
    showConfirm("Bạn thật sự muốn tẩy trắng toàn bộ lịch sử xem phim sao?", async () => {
      try {
        const q = query(collection(db, "users", user.uid, "watchHistory"));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "users", user.uid, "watchHistory", d.id)));
        await Promise.all(deletePromises);
        showToast("Đã dọn sạch lịch sử", "success");
      } catch (error) {
        console.error("Lỗi dọn sạch lịch sử:", error);
        showToast("Lỗi dọn sạch lịch sử", "error");
      }
    });
  };

  const handleResume = async (e, movie) => {
    e.preventDefault(); 
    if (resumingId) return;
    setResumingId(movie.id); 

    try {
      const data = await apiGetPhimDetail(movie.id);
      if (data && data.status) {
        const allServers = data.episodes || [];
        let targetEp = null;
        let targetServerIdx = 0;

        for (let i = 0; i < allServers.length; i++) {
          const eps = allServers[i].server_data || allServers[i].items || [];
          const found = eps.find(ep => ep.name === movie.rawEpName);
          if (found) { targetEp = found; targetServerIdx = i; break; }
        }

        if (!targetEp) targetEp = (allServers[0]?.server_data || allServers[0]?.items || [])[0];

        if (targetEp) {
          navigate(`/play/${data.movie.slug}`, {
            state: {
              videoUrl: targetEp.link_m3u8 || targetEp.m3u8 || "",
              embedFallback: targetEp.link_embed || targetEp.embed || "",
              movieName: data.movie.name,
              epName: targetEp.name,
              allServers: allServers,
              currentServerIndex: targetServerIdx,
              posterUrl: data.movie.poster_url || movie.image,
              cloudProgress: movie.progress 
            }
          });
          return;
        }
      }
      navigate(`/movie/${movie.id}`); 
    } catch (error) {
      navigate(`/movie/${movie.id}`);
    } finally {
      setResumingId(null);
    }
  };

  if (!user) return null; 

  return (
    <main className="pt-24 pb-16 min-h-screen bg-black text-white px-4 md:px-6 relative overflow-hidden">
      
      {/* Background mờ mờ cho có chiều sâu */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
      </div>

      <div className="max-w-container-max mx-auto relative z-10">
        
        {/* THÔNG TIN USER (GLASSMORPHISM TRẮNG) */}
        <section className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start mb-12 bg-white/5 p-6 md:p-8 rounded-[2rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-3 mt-1">
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter drop-shadow-md text-white">{user.displayName}</h2>
            <p className="text-white/60 font-bold tracking-widest text-sm">{user.email}</p>
            <button onClick={logout} className="mt-2 bg-white/10 text-white px-6 py-2.5 rounded-xl font-bold text-sm border border-white/20 hover:bg-white hover:text-black transition-all shadow-lg active:scale-95">ĐĂNG XUẤT</button>
          </div>
        </section>

        {/* THỐNG KÊ GIA TÀI PHIM ẢNH (PERSONAL INSIGHTS) */}
        <section className="mb-12 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group">
            <span className="material-symbols-outlined text-4xl text-yellow-500 mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform">movie</span>
            <h4 className="text-3xl font-black text-white">{history.length}</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Phim đã xem</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group">
            <span className="material-symbols-outlined text-4xl text-blue-500 mb-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform">schedule</span>
            <h4 className="text-3xl font-black text-white">{Math.round(history.length * 1.5)}</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Giờ xem (ước tính)</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group">
            <span className="material-symbols-outlined text-4xl text-green-500 mb-2 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] group-hover:scale-110 transition-transform">workspace_premium</span>
            <h4 className="text-3xl font-black text-white">VIP</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Hạng thành viên</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group">
            <span className="material-symbols-outlined text-4xl text-purple-500 mb-2 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] group-hover:scale-110 transition-transform">local_fire_department</span>
            <h4 className="text-xl md:text-2xl font-black text-white mt-1 mb-1">{history.length > 20 ? 'Thánh Cày' : 'Mọt Phim'}</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Danh hiệu</p>
          </div>
        </section>

        {/* PHIM YÊU THÍCH (LOCAL WATCHLIST) */}
        <section className="space-y-8 mb-20">
          <div className="flex items-center gap-4 border-b border-white/10 pb-6">
            <div className="w-1.5 h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
            <h3 className="text-2xl font-black uppercase tracking-tighter drop-shadow-md text-red-500">Phim Yêu Thích</h3>
          </div>

          {watchlist && watchlist.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {watchlist.map((movie) => (
                <div key={movie.slug} className="relative group cursor-pointer">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(movie.slug);
                    }}
                    className="absolute top-2 right-2 z-30 w-8 h-8 bg-black/60 hover:bg-red-600 text-white backdrop-blur-md rounded-full flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/20 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>

                  <Link to={`/movie/${movie.slug}`}>
                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden transition-all duration-500 transform group-hover:scale-[1.03] group-hover:-translate-y-2 shadow-lg group-hover:shadow-[0_15px_40px_-10px_rgba(255,255,255,0.15)] border border-white/5 group-hover:border-white/30">
                      <img src={movie.thumb_url} alt={movie.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center pointer-events-none">
                         <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/20 border border-white/40 text-white flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                           <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white"></div>
                           <span className="material-symbols-outlined text-2xl md:text-3xl ml-1 drop-shadow-md z-10" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                         </div>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
                        <p className="text-[10px] text-white font-black uppercase tracking-widest truncate bg-black/50 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-center">
                          {movie.year}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <h4 className="mt-4 font-bold text-sm line-clamp-1 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all uppercase tracking-tight">
                    {movie.name}
                  </h4>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-2xl">
               <span className="material-symbols-outlined text-5xl mb-4 text-white/30 drop-shadow-md">heart_broken</span>
              <p className="text-white/60 font-bold uppercase tracking-widest text-center">Bạn chưa lưu bộ phim nào cả!</p>
            </div>
          )}
        </section>



      </div>
    </main>
  );
}