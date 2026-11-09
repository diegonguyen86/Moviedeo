import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiGetPhimDetail } from "../api/api";
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { deleteDoc, doc } from "firebase/firestore";

const FALLBACK_POSTER = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop";

export default function MovieCard({ movie }) {
  const navigate = useNavigate();
  const [isResuming, setIsResuming] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const { addToWatchlist, removeFromWatchlist, isSaved } = useWatchlist();
  const { showToast, showConfirm } = useNotification();
  const { user } = useAuth();

  // 👇 Lớp bảo vệ số 1: Tránh lỗi crash nếu thẻ này bị gọi mà không truyền dữ liệu
  if (!movie) return null;

  const getFullImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `https://phimimg.com/${url}`;
  };

  // 👇 HÀM DỌN DẸP LỖI "TẬP: TẬP": Lọc mọi ký tự thừa, chỉ giữ lại đúng 1 chữ TẬP
  const formatEpisodeText = (text) => {
    if (!text) return "";
    const str = text.toString();
    // Nếu chỉ là số năm (ví dụ: 2024, 2023) thì để nguyên
    if (/^\d{4}$/.test(str)) return str;
    // Nếu là tập phim, xóa hết chữ "tập" và ":" bị lặp, sau đó ghép lại cho chuẩn
    const cleanText = str.replace(/tập/gi, "").replace(/:/g, "").trim();
    return `TẬP ${cleanText}`;
  };

  const handleToggleWatchlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!movie || !movie.id) return;
    
    if (isSaved(movie.id)) {
      removeFromWatchlist(movie.id);
      showToast("Đã bỏ khỏi danh sách", "info");
    } else {
      addToWatchlist(movie);
      showToast("Đã thêm vào danh sách", "success");
    }
  };

  const handleDeleteHistory = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !movie.docId) return;
    
    showConfirm("Xóa phim này khỏi danh sách đang xem?", async () => {
      try {
        // Chỉ xóa trên Firebase để ẩn khỏi trang chủ
        // Cố tình giữ lại LocalStorage để phục hồi tiến trình "zombie" nếu user muốn xem lại
        await deleteDoc(doc(db, "users", user.uid, "watchHistory", movie.docId));
        showToast("Đã xóa khỏi trang chủ", "success");
      } catch (error) {
        console.error("Lỗi xóa phim:", error);
        showToast("Lỗi khi xóa phim", "error");
      }
    });
  };

  const handleResume = async (e) => {
    e.preventDefault(); 
    if (isResuming) return;
    setIsResuming(true);

    try {
      // 👇 Bảo vệ khi Resume: Không có ID thì dừng
      if (!movie.id) return;
      
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
          navigate(`/play/${data.movie.slug || movie.id}`, {
            state: {
              videoUrl: targetEp.link_m3u8 || targetEp.m3u8 || "",
              embedFallback: targetEp.link_embed || targetEp.embed || "",
              movieName: data.movie.name,
              epName: targetEp.name,
              allServers: allServers,
              currentServerIndex: targetServerIdx,
              posterUrl: getFullImageUrl(data.movie.poster_url),
              cloudProgress: movie.progress
            }
          });
          return;
        }
      }
      // Không lấy được tập để phát tiếp -> mở trang chi tiết phim thay vì đứng im
      navigate(`/movie/${movie.id}`);
    } catch (error) {
      if (movie.id) navigate(`/movie/${movie.id}`);
    } finally {
      setIsResuming(false);
    }
  };

  const safeLink = movie.id ? `/movie/${movie.id}` : "#";
  const badgeText = formatEpisodeText(movie.year);
  const progressPercent = movie.isHistory
    ? (movie.progress ? Math.min(Math.round((movie.progress / (movie.duration || 5400)) * 100), 100) : 3)
    : 0;
  const saved = !movie.isHistory && isSaved(movie.id);
  // Dòng phụ dưới tên: phim đang xem thì nói tập, còn lại nói năm · chất lượng (thứ dùng để chọn phim)
  const metaText = movie.isHistory
    ? (badgeText && !/full/i.test(badgeText) ? `Đang xem ${badgeText.toLowerCase()}` : "Xem tiếp")
    : [/^\d{4}$/.test(String(movie.year)) ? movie.year : null, movie.quality].filter(Boolean).join(" · ");

  return (
    <Link
      to={safeLink}
      onClick={movie.isHistory ? handleResume : undefined}
      className={`group block ${!movie.id ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-white/10">
        {/* Khung chờ ảnh */}
        {!isImageLoaded && <div className="skeleton absolute inset-0" />}

        <img
          alt={movie.title || ""}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsImageLoaded(true)}
          onError={(e) => {
            // Ảnh lỗi: thử ảnh thumb, cuối cùng dùng ảnh dự phòng (tránh kẹt khung chờ mãi mãi)
            const img = e.currentTarget;
            const thumb = getFullImageUrl(movie.thumb_url);
            if (thumb && img.src !== thumb && img.dataset.triedThumb !== "1") {
              img.dataset.triedThumb = "1";
              img.src = thumb;
            } else if (img.src !== FALLBACK_POSTER) {
              img.src = FALLBACK_POSTER;
            } else {
              setIsImageLoaded(true);
            }
          }}
          className={`h-full w-full object-cover transition-[opacity,transform] duration-500 md:group-hover:scale-[1.04] ${isImageLoaded ? "opacity-100" : "opacity-0"}`}
          src={movie.image || FALLBACK_POSTER}
        />

        {/* Nhãn tập / năm: một nhãn trung tính, không chuyển màu */}
        {/* Chỉ hiện khi là thông tin tập (vd "Tập 12"); năm đã nằm ở dòng phụ dưới tên */}
        {badgeText && !movie.isHistory && !/^\d{4}$/.test(badgeText) && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {badgeText}
          </span>
        )}

        {/* Lớp phủ rê chuột (chỉ máy tính, không chặn chạm) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-300 md:group-hover:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-white text-black">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </span>
        </div>

        {/* Nút phụ: luôn hiện trên điện thoại, rê mới hiện trên máy tính */}
        {movie.isHistory ? (
          <button
            onClick={handleDeleteHistory}
            aria-label="Xoá khỏi danh sách đang xem"
            title="Xoá khỏi danh sách đang xem"
            className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-[opacity,background-color] hover:bg-black/85 md:opacity-0 md:group-hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        ) : (
          <button
            onClick={handleToggleWatchlist}
            aria-label={saved ? "Bỏ khỏi danh sách yêu thích" : "Thêm vào danh sách yêu thích"}
            aria-pressed={saved}
            title={saved ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
            // Chưa lưu: chỉ hiện khi rê chuột trên máy tính (điện thoại lưu ở trang chi tiết, tránh lưới đầy dấu "+")
            className={`absolute right-1.5 top-1.5 size-8 items-center justify-center rounded-full bg-black/60 text-white transition-[opacity,background-color] hover:bg-black/85 ${saved ? "flex" : "hidden md:flex md:opacity-0 md:group-hover:opacity-100"}`}
          >
            <span className="material-symbols-outlined text-[18px]" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {saved ? "favorite" : "add"}
            </span>
          </button>
        )}

        {/* Tiến độ xem: màu nhấn thương hiệu */}
        {movie.isHistory && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div className="h-full bg-brand" style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        {/* Đang mở phim để xem tiếp */}
        {isResuming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="material-symbols-outlined animate-spin text-[28px] text-white motion-reduce:animate-none">progress_activity</span>
            <span className="sr-only" role="status">Đang mở phim</span>
          </div>
        )}
      </div>

      <h4 title={movie.title || ""} className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug text-fg transition-colors md:group-hover:text-white">
        {movie.title || "Đang tải…"}
      </h4>
      {metaText && <p className="mt-0.5 truncate text-xs text-fg-3">{metaText}</p>}
    </Link>
  );
}
