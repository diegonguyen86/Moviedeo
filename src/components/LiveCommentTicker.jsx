import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function LiveCommentTicker() {
  const { getRankInfo, user, isApproved } = useAuth();
  const [comments, setComments] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  // Bấm X -> ẩn đi, chỉ hiện lại khi có bình luận MỚI hơn (nhớ id bình luận mới nhất lúc tắt)
  const [dismissedId, setDismissedId] = useState(() => {
    try { return localStorage.getItem("live_comment_dismissed") || ""; } catch { return ""; }
  });
  const dismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const latestId = comments[0]?.id || "";
    setDismissedId(latestId);
    try { localStorage.setItem("live_comment_dismissed", latestId); } catch { /* bỏ qua */ }
  };

  // Chỉ hiện cho thành viên đã được duyệt, và không hiện ở trang xem phim / trang đăng nhập TV
  const isHidden = !user || !isApproved || location.pathname.startsWith("/play/") || location.pathname.startsWith("/tv");

  useEffect(() => {
    // Ngừng query Firebase khi bị ẩn (bảo vệ lưu lượng Firebase)
    if (isHidden) return;

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
    }, (err) => {
      console.warn("Không tải được bình luận live:", err);
    });

    return () => unsubscribe();
  }, [isHidden]);

  useEffect(() => {
    if (isHidden) return;

    // Chuyển đổi bình luận mỗi 5 giây
    if (comments.length === 0 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % comments.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [comments.length, isHovered, isHidden]);

  // ĐẶT SAU TẤT CẢ CÁC HOOK ĐỂ TRÁNH LỖI REACT ERROR 300
  if (isHidden) {
    return null;
  }

  if (comments.length === 0) return null;
  if (dismissedId && comments[0]?.id === dismissedId) return null;

  // Đảm bảo không bị crash nếu comments bị xoá bớt khiến currentIndex vượt quá mảng
  const safeIndex = currentIndex >= comments.length ? 0 : currentIndex;
  const currentComment = comments[safeIndex];
  if (!currentComment) return null;

  const rank = getRankInfo(currentComment.totalWatchSeconds || 0);
  const avatar = currentComment.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentComment.displayName || "U")}&background=27272a&color=f4f4f5`;

  return (
    // Chỉ hiện trên máy tính: ở điện thoại khung cố định này đè lên nút của trang
    <div
      className="group/ticker fixed bottom-5 left-5 z-40 hidden md:block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tắt bình luận mới"
        title="Tắt (hiện lại khi có bình luận mới)"
        className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full border border-line bg-raised text-fg-2 shadow-lg transition-colors hover:bg-white hover:text-black"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
      <Link
        key={currentComment.id}
        to={`/movie/${currentComment.movieId}`}
        className="animate-fade-in flex max-w-[360px] items-center gap-3 rounded-2xl border border-line bg-raised/95 py-2 pl-2 pr-4 shadow-2xl transition-colors hover:border-line-strong"
        title="Bình luận mới nhất"
      >
        <img
          src={avatar}
          alt=""
          onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentComment.displayName || "U")}&background=27272a&color=f4f4f5`; }}
          className="size-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        />
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1.5 text-xs">
            <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <span className="truncate font-medium text-fg">{currentComment.displayName}</span>
            <span className="shrink-0" title={rank.name}>{rank.icon}</span>
            <span className="truncate text-fg-3">· {currentComment.movieName}</span>
          </p>
          <p className="mt-1 truncate text-sm text-fg-2">{currentComment.text}</p>
        </div>
      </Link>
    </div>
  );
}
