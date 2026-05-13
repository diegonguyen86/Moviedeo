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
import { apiGetPhimDetail } from "../api/api"; // QUAN TRỌNG: Import hàm gọi API

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState(null); // State để hiện loading khi bấm vào phim
  const navigate = useNavigate();

  // 1. Lấy dữ liệu lịch sử từ Firebase (Real-time)
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
          year: doc.data().epName,
          // 👇 Kéo thêm dữ liệu để làm Cloud Sync
          rawEpName: doc.data().epName,
          progress: doc.data().progress
        }));
        setHistory(data);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  // 2. Hàm xóa TỪNG phim
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

  // 3. Hàm xóa TẤT CẢ
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

  // 4. Hàm Resume 1-Click (Bay thẳng vào VideoPlayer)
  const handleResume = async (e, movie) => {
    e.preventDefault(); 
    if (resumingId) return;
    setResumingId(movie.id); // Bật loading cho card này

    try {
      const data = await apiGetPhimDetail(movie.id);
      if (data && data.status) {
        const allServers = data.episodes || [];
        let targetEp = null;
        let targetServerIdx = 0;

        // Tìm tập phim đang xem dở
        for (let i = 0; i < allServers.length; i++) {
          const eps = allServers[i].server_data || allServers[i].items || [];
          const found = eps.find(ep => ep.name === movie.rawEpName);
          if (found) { targetEp = found; targetServerIdx = i; break; }
        }

        // Nếu không tìm thấy thì lấy tập 1
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
              cloudProgress: movie.progress // TRUYỀN PROGRESS QUA
            }
          });
          return;
        }
      }
      navigate(`/movie/${movie.id}`); // Lỗi thì trả về trang chi tiết
    } catch (error) {
      navigate(`/movie/${movie.id}`);
    } finally {
      setResumingId(null);
    }
  };

  if (!user) return null; 

  return (
    <main className="pt-24 pb-20 min-h-screen bg-black text-white px-6">
      <div className="max-w-container-max mx-auto">
        
        {/* THÔNG TIN USER */}
        <section className="flex flex-col md:flex-row gap-10 items-center md:items-start mb-16 bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-2xl">
            <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-4">
            <h2 className="text-4xl font-black uppercase tracking-tighter">{user.displayName}</h2>
            <p className="text-zinc-400 font-medium">{user.email}</p>
            <button onClick={logout} className="bg-red-500/10 text-red-500 px-6 py-2 rounded-xl font-bold border border-red-500/20 hover:bg-red-500 hover:text-white transition-all">ĐĂNG XUẤT</button>
          </div>
        </section>

        {/* DANH SÁCH PHIM ĐÃ XEM */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-primary rounded-full"></div>
              <h3 className="text-3xl font-black uppercase tracking-tighter">Phim Đã Xem</h3>
            </div>
            {history.length > 0 && (
              <button onClick={clearAllHistory} className="text-zinc-600 hover:text-red-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">
                <span className="material-symbols-outlined text-lg">delete_sweep</span>
                Xóa tất cả
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center animate-pulse">Đang tìm lại dấu vết...</div>
          ) : history.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {history.map((movie) => (
                <div 
                  key={movie.docId} 
                  className="relative group cursor-pointer"
                  onClick={(e) => handleResume(e, movie)} // 👇 GỌI HÀM BAY THẲNG VÀO PHIM
                >
                  {/* FIX MOBILE: Nút xóa luôn hiện trên Mobile (opacity-100), chỉ ẩn trên Máy tính (md:opacity-0) */}
                  <button 
                    onClick={(e) => deleteOneHistory(e, movie.docId)}
                    className="absolute top-2 right-2 z-30 w-8 h-8 bg-black/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 border border-white/10"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>

                  {/* THIẾT KẾ CARD PHIM */}
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 group-hover:border-primary/50 transition-all">
                    <img src={movie.image} alt={movie.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    
                    {/* HIỆU ỨNG LOADING KHI BẤM VÀO */}
                    {resumingId === movie.id ? (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-white font-bold mt-2 animate-pulse">Đang nạp...</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                    )}
                    
                    <div className="absolute bottom-3 left-3 right-3 z-10">
                      <p className="text-[10px] text-primary font-black uppercase tracking-widest truncate bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-primary/20">
                        {movie.year ? `Tập: ${movie.year}` : "Đang cập nhật"}
                      </p>
                    </div>
                  </div>
                  
                  <h4 className="mt-3 font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors uppercase tracking-tighter">
                    {movie.title}
                  </h4>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-zinc-900/20 rounded-[2.5rem] border border-dashed border-white/10">
              <p className="text-zinc-600 font-bold uppercase tracking-widest">Lịch sử phim của bạn còn trong trắng quá!</p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}