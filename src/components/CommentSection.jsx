import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { useNotification } from "../context/NotificationContext";

export default function CommentSection({ movieId, movieName }) {
  const { user, userData, getRankInfo, loginWithGoogle } = useAuth();
  const { showToast } = useNotification();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentLimit, setCommentLimit] = useState(10);

  useEffect(() => {
    if (!movieId) return;
    
    // Sử dụng subcollection để tránh lỗi Composite Index của Firebase
    const q = query(
      collection(db, "comments", movieId, "list"),
      orderBy("createdAt", "desc"),
      limit(commentLimit)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setComments(data);
        setLoading(false);
      },
      (error) => {
        console.error("Lỗi khi tải bình luận:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [movieId, commentLimit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      loginWithGoogle();
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const commentData = {
        uid: user.uid,
        displayName: user.displayName || "Thành viên ẩn danh",
        photoURL: user.photoURL || "https://ui-avatars.com/api/?name=User",
        text: newComment.trim(),
        totalWatchSeconds: userData?.totalWatchSeconds || 0,
        createdAt: serverTimestamp()
      };

      // 1. Lưu vào bình luận của phim
      await addDoc(collection(db, "comments", movieId, "list"), commentData);

      // 2. Lưu vào luồng bình luận toàn cục (kèm thông tin phim)
      await addDoc(collection(db, "global_comments"), {
        ...commentData,
        movieId,
        movieName: movieName || "Phim Moviedeo"
      });
      setNewComment("");
      showToast("Đã gửi bình luận!", "success");
    } catch (error) {
      console.error("Lỗi gửi bình luận:", error);
      showToast("Lỗi: " + (error.message || "Không thể gửi bình luận"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeAgo = (date) => {
    if (!date || typeof date.toDate !== 'function') return "Vừa xong";
    const seconds = Math.floor((new Date() - date.toDate()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return "Vừa xong";
  };

  const currentUserRank = getRankInfo(userData?.totalWatchSeconds || 0);

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 backdrop-blur-md">
      <h3 className="text-[18px] md:text-[22px] font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
        <span className="material-symbols-outlined text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">forum</span>
        Bình luận
      </h3>

      {/* Ô NHẬP BÌNH LUẬN */}
      <form onSubmit={handleSubmit} className="mb-8 flex gap-3 md:gap-4 items-start">
        {user ? (
          <div className={`relative shrink-0 rounded-full border-2 ${currentUserRank.border} ${currentUserRank.glow}`}>
            <img src={user.photoURL} alt="Avatar" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" />
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-black border border-white/20 flex items-center justify-center text-[8px] md:text-[10px] ${currentUserRank.color}`} title={currentUserRank.name}>
              {currentUserRank.icon}
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-zinc-400">person</span>
          </div>
        )}
        
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? "Bạn nghĩ gì về bộ phim này?" : "Đăng nhập để bình luận..."}
            className="w-full bg-black/40 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 focus:bg-black/60 transition-all resize-none min-h-[80px]"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || (user && !newComment.trim())}
              className="px-6 py-2 bg-gradient-to-r from-[#e50914] to-[#b20710] text-white font-bold rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
            >
              {isSubmitting ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">send</span>
              )}
              {user ? "Gửi" : "Đăng nhập Google"}
            </button>
          </div>
        </div>
      </form>

      {/* DANH SÁCH BÌNH LUẬN */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center text-zinc-500 py-4 animate-pulse">Đang tải bình luận...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-zinc-500 py-8 border-t border-white/5">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </div>
        ) : (
          <>
            {comments.map((comment) => {
              const rank = getRankInfo(comment.totalWatchSeconds || 0);
              return (
                <div key={comment.id} className="flex gap-3 md:gap-4 group">
                  <div className={`relative shrink-0 rounded-full border-2 h-fit ${rank.border}`}>
                    <img src={comment.photoURL} alt={comment.displayName} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-black border border-white/20 flex items-center justify-center text-[8px] md:text-[10px] ${rank.color}`} title={rank.name}>
                      {rank.icon}
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-black/30 border border-white/5 rounded-2xl rounded-tl-sm p-4 hover:bg-black/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-white text-sm">{comment.displayName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-black/50 ${rank.color} ${rank.border}`}>
                        {rank.name}
                      </span>
                      <span className="text-xs text-zinc-500 ml-auto">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                      {comment.text}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {/* NÚT TẢI THÊM (Chỉ hiện nếu số lượng bình luận bằng với limit, nghĩa là có thể còn nữa) */}
            {comments.length >= commentLimit && (
              <div className="text-center pt-4">
                <button 
                  onClick={() => setCommentLimit(prev => prev + 10)}
                  className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-sm font-bold border border-white/10 transition-all shadow-lg hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  Tải thêm bình luận
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
