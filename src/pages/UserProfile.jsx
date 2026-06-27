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
  getDocs,
  getDoc,
  setDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { apiGetPhimDetail } from "../api/api"; 
import LoadingLogo from "../components/LoadingLogo"; 
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import { Link } from "react-router-dom";

export default function UserProfile() {
  const { user, logout, userData, getRankInfo } = useAuth();
  const [stats, setStats] = useState({ watchedCount: 0, totalWatchSeconds: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { watchlist, removeFromWatchlist } = useWatchlist();
  const { showConfirm, showToast } = useNotification();

  useEffect(() => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      
      const checkAndInitStats = async () => {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        
        let updates = {};
        let needUpdate = false;

        if (data.watchedCount === undefined) {
          const historySnap = await getDocs(collection(db, "users", user.uid, "watchHistory"));
          updates.watchedCount = historySnap.size;
          needUpdate = true;
        }

        if (data.totalWatchSeconds === undefined) {
          const count = updates.watchedCount !== undefined ? updates.watchedCount : (data.watchedCount || 0);
          updates.totalWatchSeconds = count * 5400; // Giả lập 1 phim = 1.5 giờ = 5400 giây
          needUpdate = true;
        }

        if (needUpdate) {
          await setDoc(userRef, updates, { merge: true });
        }
      };
      checkAndInitStats();

      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setStats({ 
            watchedCount: docSnap.data().watchedCount || 0,
            totalWatchSeconds: docSnap.data().totalWatchSeconds || 0
          });
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const actualHours = Math.floor(stats.totalWatchSeconds / 3600);
  const userRank = getRankInfo(stats.totalWatchSeconds);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <LoadingLogo />
      </div>
    );
  }

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
            <h4 className="text-3xl font-black text-white">{stats.watchedCount}</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Phim đã xem</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group">
            <span className="material-symbols-outlined text-4xl text-blue-500 mb-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform">schedule</span>
            <h4 className="text-3xl font-black text-white">{actualHours}</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Giờ xem (thực tế)</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group">
            <span className="material-symbols-outlined text-4xl text-green-500 mb-2 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] group-hover:scale-110 transition-transform">workspace_premium</span>
            <h4 className="text-3xl font-black text-white">VIP</h4>
            <p className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Hạng thành viên</p>
          </div>
          <div className={`bg-white/5 border ${userRank.border} rounded-2xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-all group ${userRank.glow}`}>
            <span className={`text-4xl mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] group-hover:scale-110 transition-transform ${userRank.color}`}>{userRank.icon}</span>
            <div className="flex items-center gap-2 mt-1 mb-1">
              <h4 className={`text-[18px] md:text-xl font-black ${userRank.color}`}>{userRank.name}</h4>
              <div className="relative group/tooltip">
                <span className="material-symbols-outlined text-[14px] text-white/40 cursor-help hover:text-white transition-colors border border-white/20 rounded-full w-4 h-4 flex items-center justify-center">question_mark</span>
                
                {/* TOOLTIP GIẢI THÍCH DANH HIỆU */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[260px] md:w-[320px] bg-black/90 backdrop-blur-3xl border border-white/20 rounded-xl p-4 shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 text-left pointer-events-none scale-95 group-hover/tooltip:scale-100 origin-bottom">
                  <h5 className="text-white font-black text-sm uppercase tracking-widest border-b border-white/10 pb-2 mb-2">Hệ thống Danh Hiệu</h5>
                  <ul className="space-y-1.5 text-xs">
                    <li className="text-zinc-300"><span className="text-zinc-400 font-bold">👀 Xem Dạo (0-5h):</span> Vừa tạo tài khoản, đang đi dạo.</li>
                    <li className="text-zinc-300"><span className="text-emerald-400 font-bold">🌱 Tập Sự (5-30h):</span> Đã cày xong bộ phim đầu tiên.</li>
                    <li className="text-zinc-300"><span className="text-blue-400 font-bold">🎯 Thợ Săn (30-100h):</span> Thường xuyên đón tập mới.</li>
                    <li className="text-zinc-300"><span className="text-purple-400 font-bold">⭐ Đẳng Cấp (100-300h):</span> Có gu xem phim cực đa dạng.</li>
                    <li className="text-zinc-300"><span className="text-pink-400 font-bold">💬 Chuyên Gia (300-600h):</span> Đủ trình nhận xét như nhà phê bình.</li>
                    <li className="text-zinc-300"><span className="text-yellow-400 font-bold">👑 Trùm Điện Ảnh (600-1200h):</span> Nhìn poster đoán ngay đạo diễn.</li>
                    <li className="text-zinc-300"><span className="text-red-500 font-bold">🔥 Tinh Anh (>1200h):</span> Đỉnh cao cày phim, không bỏ sót siêu phẩm nào.</li>
                  </ul>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/90 border-b border-r border-white/20 rotate-45"></div>
                </div>
              </div>
            </div>
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