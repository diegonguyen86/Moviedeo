import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function LiveCommentTicker() {
  const { getRankInfo } = useAuth();
  const [comments, setComments] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();

  // Ẩn ticker nếu đang ở trang xem phim (bắt đầu bằng /play/)
  if (location.pathname.startsWith("/play/")) {
    return null;
  }

  useEffect(() => {
    // Lắng nghe 5 bình luận mới nhất
    const q = query(
      collection(db, "global_comments"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(data);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Chuyển đổi bình luận mỗi 5 giây
    let timer;
    if (comments.length > 1 && !isHovered) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % comments.length);
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [comments.length, isHovered]);

  if (comments.length === 0) return null;

  const currentComment = comments[currentIndex];
  const rank = getRankInfo(currentComment.totalWatchSeconds || 0);

  return (
    <div 
      className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 transition-all duration-500 ease-in-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link 
        to={`/movie/${currentComment.movieId}`}
        className="group relative flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full py-1.5 pl-2 pr-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:bg-white/10 hover:border-white/40 transition-all max-w-[320px] md:max-w-[400px] overflow-hidden"
      >
        <div className={`relative shrink-0 rounded-full border border-white/20 ${rank.border}`}>
          <img 
            src={currentComment.photoURL} 
            alt={currentComment.displayName} 
            className="w-8 h-8 rounded-full object-cover" 
          />
        </div>
        
        <div className="flex flex-col overflow-hidden leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[11px] text-white/90 truncate max-w-[100px]">
              {currentComment.displayName}
            </span>
            <span className="text-[9px] text-white/50 uppercase truncate max-w-[120px]">
              {currentComment.movieName}
            </span>
          </div>
          <span className="text-xs text-white truncate font-medium mt-0.5">
            "{currentComment.text}"
          </span>
        </div>

        {/* Chấm tròn báo Live */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
      </Link>
    </div>
  );
}
