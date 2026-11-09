import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, where, getDocs } from "firebase/firestore";
import { useNotification } from "../context/NotificationContext";

export default function CommentSection({ movieId, movieName }) {
  const { user, userData, getRankInfo, loginWithGoogle } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentLimit, setCommentLimit] = useState(10);

  // Sang phim khác thì reset số bình luận đang hiển thị
  useEffect(() => {
    setCommentLimit(10);
    setLoading(true);
  }, [movieId]);

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
    if (!newComment.trim() || !movieId || isSubmitting) return;
    if (newComment.trim().length > 1000) {
      showToast("Bình luận tối đa 1000 ký tự nhé!", "error");
      return;
    }

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

  const handleDelete = (commentId, comment) => {
    showConfirm("Bạn có chắc chắn muốn xoá bình luận này?", () => deleteComment(commentId, comment));
  };

  const deleteComment = async (commentId, comment) => {
    try {
      // 1. Xoá khỏi bình luận của phim
      await deleteDoc(doc(db, "comments", movieId, "list", commentId));

      // 2. Xoá khỏi luồng bình luận toàn cục (global_comments)
      try {
        const globalQuery = query(
          collection(db, "global_comments"),
          where("uid", "==", comment.uid),
          where("movieId", "==", movieId),
          where("text", "==", comment.text)
        );
        const globalSnap = await getDocs(globalQuery);
        const deletePromises = globalSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      } catch (globalErr) {
        console.warn("Không thể xoá global_comments:", globalErr);
      }

      showToast("Đã xoá bình luận", "success");
    } catch (error) {
      console.error("Lỗi xoá bình luận:", error);
      showToast("Không thể xoá bình luận", "error");
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
  const avatarOf = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=27272a&color=f4f4f5`;

  return (
    <div className="w-full">
      <h2 className="mb-4 text-lg font-semibold text-fg">
        Bình luận {comments.length > 0 && <span className="ml-1 text-sm font-normal text-fg-3">{comments.length >= commentLimit ? `${commentLimit}+` : comments.length}</span>}
      </h2>

      {/* Ô nhập bình luận */}
      <form onSubmit={handleSubmit} className="mb-8 flex items-start gap-3">
        <img
          src={user?.photoURL || avatarOf(user?.displayName || user?.email?.split("@")[0])}
          alt=""
          title={currentUserRank.name}
          className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        />
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? "Bạn nghĩ gì về bộ phim này?" : "Đăng nhập để bình luận"}
            maxLength={1000}
            className="min-h-[88px] w-full resize-none rounded-xl border border-line-strong bg-card px-3.5 py-3 text-[15px] text-fg placeholder:text-fg-3 transition-colors focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/10"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-fg-3">{newComment.length > 800 ? `${newComment.length}/1000` : ""}</span>
            <button
              type="submit"
              disabled={isSubmitting || (user && !newComment.trim())}
              className="btn-primary flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSubmitting ? "animate-spin motion-reduce:animate-none" : ""}`}>
                {isSubmitting ? "progress_activity" : "send"}
              </span>
              {user ? "Gửi" : "Đăng nhập"}
            </button>
          </div>
        </div>
      </form>

      {/* Danh sách bình luận */}
      {loading ? (
        <ul aria-busy="true" className="space-y-5">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3">
              <div className="skeleton size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <div className={`skeleton h-3 rounded-full ${["w-1/4", "w-1/3", "w-1/5"][i]}`} />
                <div className={`skeleton h-3 rounded-full ${["w-3/4", "w-1/2", "w-2/3"][i]}`} />
              </div>
            </li>
          ))}
          <span className="sr-only" role="status">Đang tải bình luận</span>
        </ul>
      ) : comments.length === 0 ? (
        <p className="border-t border-line py-8 text-center text-sm text-fg-2">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {comments.map((comment) => {
              const rank = getRankInfo(comment.totalWatchSeconds || 0);
              const canDelete = user && (user.uid === comment.uid || user.uid === "qD9qHFwiucgQOj6bXHoCIuHuoWv1");
              return (
                <li key={comment.id} className="group flex gap-3 py-4 first:pt-0">
                  <img
                    src={comment.photoURL || avatarOf(comment.displayName)}
                    alt=""
                    onError={(e) => { e.currentTarget.src = avatarOf(comment.displayName); }}
                    className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-fg">{comment.displayName}</span>
                      <span className={`text-xs ${rank.color}`} title="Danh hiệu theo giờ xem">{rank.icon} {rank.name}</span>
                      <span className="text-xs text-fg-3">· {timeAgo(comment.createdAt)}</span>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(comment.id, comment)}
                          className="ml-auto flex size-8 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-white/5 hover:text-fg md:opacity-0 md:group-hover:opacity-100"
                          aria-label="Xoá bình luận"
                          title="Xoá bình luận"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg-2">{comment.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Còn nữa thì có nút tải thêm */}
          {comments.length >= commentLimit && (
            <div className="pt-2 text-center">
              <button
                onClick={() => setCommentLimit((prev) => prev + 10)}
                className="h-10 rounded-lg border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-white/5"
              >
                Xem thêm bình luận
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
