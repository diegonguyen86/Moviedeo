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

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState(null); 
  const navigate = useNavigate();

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
    if (window.confirm("Xóa phim này khỏi lịch sử?")) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "watchHistory", docId));
      } catch (error) {
        console.error("Lỗi xóa phim:", error);
      }
    }
  };

  const clearAllHistory = async () => {
    if (window.confirm("Bạn thật sự muốn tẩy trắng toàn bộ lịch sử xem phim sao?")) {
      try {
        const q = query(collection(db, "users", user.uid, "watchHistory"));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "users", user.uid, "watchHistory", d.id)));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Lỗi dọn sạch lịch sử:", error);
      }
    }
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
    <main className="pt-32 pb-20 min-h-screen bg-black text-white px-6 relative overflow-hidden">
      
      {/* Background mờ mờ cho có chiều sâu */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
      </div>

      <div className="max-w-container-max mx-auto relative z-10">
        
        {/* THÔNG TIN USER (GLASSMORPHISM TRẮNG) */}
        <section className="flex flex-col md:flex-row gap-10 items-center md:items-start mb-16 bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-4 mt-2">
            <h2 className="text-4xl font-black uppercase tracking-tighter drop-shadow-md text-white">{user.displayName}</h2>
            <p className="text-white/60 font-bold tracking-widest">{user.email}</p>
            <button onClick={logout} className="mt-2 bg-white/10 text-white px-8 py-3 rounded-xl font-bold border border-white/20 hover:bg-white hover:text-black transition-all shadow-lg active:scale-95">ĐĂNG XUẤT</button>
          </div>
        </section>

        {/* DANH SÁCH PHIM ĐÃ XEM */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
              <h3 className="text-3xl font-black uppercase tracking-tighter drop-shadow-md">Phim Đã Xem</h3>
            </div>
            {history.length > 0 && (
              <button onClick={clearAllHistory} className="text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10">
                <span className="material-symbols-outlined text-lg">delete_sweep</span>
                Xóa tất cả
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
               <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
               <span className="mt-4 text-white/50 font-bold uppercase tracking-widest animate-pulse">Đang tìm lại dấu vết...</span>
            </div>
          ) : history.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {history.map((movie) => (
                <div 
                  key={movie.docId} 
                  className="relative group cursor-pointer"
                  onClick={(e) => handleResume(e, movie)} 
                >
                  <button 
                    onClick={(e) => deleteOneHistory(e, movie.docId)}
                    className="absolute top-2 right-2 z-30 w-8 h-8 bg-black/60 hover:bg-red-600 text-white backdrop-blur-md rounded-full flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/20 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>

                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden transition-all duration-500 transform group-hover:scale-[1.03] group-hover:-translate-y-2 shadow-lg group-hover:shadow-[0_15px_40px_-10px_rgba(255,255,255,0.15)] border border-white/5 group-hover:border-white/30">
                    <img src={movie.image} alt={movie.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    
                    {resumingId === movie.id ? (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="text-[10px] text-white font-bold mt-3 animate-pulse tracking-widest uppercase">Đang nạp...</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center pointer-events-none">
                         <div className="w-14 h-14 rounded-full bg-white/10 border border-white/30 text-white flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                           <span className="material-symbols-outlined text-3xl ml-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">resume</span>
                         </div>
                      </div>
                    )}
                    
                    {/* 👇 ĐÃ FIX: Chỗ này sẽ dùng lại Regex dọn sạch chữ y hệt bên MovieCard */}
                    <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
                      <p className="text-[10px] text-white font-black uppercase tracking-widest truncate bg-black/50 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-center">
                        {movie.year ? (movie.year.toString().match(/^\d{4}$/) ? movie.year : `TẬP ${movie.year.toString().replace(/tập/gi, "").replace(/:/g, "").trim()}`) : "Đang cập nhật"}
                      </p>
                    </div>
                  </div>
                  
                  <h4 className="mt-4 font-bold text-sm line-clamp-1 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all uppercase tracking-tight">
                    {movie.title}
                  </h4>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center bg-white/5 backdrop-blur-md rounded-[3rem] border border-white/10 shadow-2xl">
               <span className="material-symbols-outlined text-6xl mb-4 text-white/30 drop-shadow-md">history</span>
              <p className="text-white/60 font-bold uppercase tracking-widest">Lịch sử phim của bạn còn trong trắng quá!</p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}