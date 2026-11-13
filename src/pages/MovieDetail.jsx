import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { apiGetPhimDetail, apiGetTrailer, apiGetRelatedSeasons } from "../api/api";
import { useWatchlist } from "../hooks/useWatchlist";
import { useNotification } from "../context/NotificationContext";
import TrailerModal from "../components/TrailerModal";
import CommentSection from "../components/CommentSection";
import { DetailSkeleton } from "../components/Skeletons";
import { useDelayedLoading } from "../hooks/useDelayedLoading";

// Chuyển nội dung HTML của API thành chữ thuần (giữ xuống dòng, giải mã &amp; &quot; ...)
const decodeHtmlText = (html) => {
  if (!html) return "";
  const withBreaks = String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  try {
    const parsed = new DOMParser().parseFromString(withBreaks, "text/html");
    return (parsed.body.textContent || "").trim();
  } catch {
    return withBreaks.replace(/<[^>]*>?/gm, "").trim();
  }
};

const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://phimimg.com/${url}`;
};

const FALLBACK_POSTER = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop";

const episodeLabel = (name) => {
  const s = String(name || "").replace(/tập/gi, "").replace(/:/g, "").trim();
  if (!s) return "";
  return /^\d+$/.test(s) ? `Tập ${s}` : s; // "Full", "Trailer" giữ nguyên
};

// Nút phụ dạng viền (evon button.md: outline là nút mặc định)
const OutlineButton = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`flex h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-white/5 disabled:opacity-60 ${className}`}
  >
    {children}
  </button>
);

export default function MovieDetail() {
  const { showToast } = useNotification();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [movieDetails, setMovieDetails] = useState(null);
  const [movieServers, setMovieServers] = useState([]);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [relatedSeasons, setRelatedSeasons] = useState([]);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [history, setHistory] = useState(null); // tập đang xem dở của phim này

  // Trailer & Watchlist state
  const [trailerKey, setTrailerKey] = useState(null);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isTrailerLoading, setIsTrailerLoading] = useState(false);
  const [noTrailer, setNoTrailer] = useState(false); // đã dò xong và phim này không có trailer
  const { addToWatchlist, removeFromWatchlist, isSaved } = useWatchlist();
  const showSkeleton = useDelayedLoading(loading);

  const handleWatchTrailer = async () => {
    if (trailerKey) {
      setIsTrailerOpen(true);
      return;
    }
    setIsTrailerLoading(true);
    const key = await apiGetTrailer(id, movieDetails.origin_name || movieDetails.name, movieDetails);
    setIsTrailerLoading(false);
    if (key) {
      setTrailerKey(key);
      setIsTrailerOpen(true);
    } else {
      setNoTrailer(true);
      showToast("Chưa tìm thấy trailer cho phim này", "error");
    }
  };

  // Dò trailer ngay khi có thông tin phim (mất ~2s: hỏi TMDB + kiểm tra YouTube) -> bấm là mở liền,
  // phim không có trailer thì nút hiện sẵn "Chưa có trailer"
  useEffect(() => {
    if (!movieDetails) return;
    let alive = true;
    apiGetTrailer(id, movieDetails.origin_name || movieDetails.name, movieDetails).then((key) => {
      if (!alive) return;
      if (key) setTrailerKey(key);
      else setNoTrailer(true);
    });
    return () => { alive = false; };
  }, [id, movieDetails]);

  useEffect(() => {
    window.scrollTo(0, 0);
    let isCurrent = true; // Bỏ qua kết quả trả về muộn của phim trước khi đã chuyển sang phim khác
    // Reset toàn bộ dữ liệu của phim cũ (tránh hiện trailer / các phần / tập phim của phim trước)
    setSelectedServerIndex(0);
    setMovieDetails(null);
    setMovieServers([]);
    setRelatedSeasons([]);
    setTrailerKey(null);
    setNoTrailer(false);
    setIsTrailerOpen(false);
    setIsDescExpanded(false);
    const fetchMovieData = async () => {
      setLoading(true);
      try {
        const data = await apiGetPhimDetail(id);
        if (!isCurrent) return;
        if (data && data.status === true && data.movie) {
          setMovieDetails(data.movie);
          setMovieServers(data.episodes || []);

          apiGetRelatedSeasons(data.movie.name, data.movie.origin_name)
            .then(seasons => { if (isCurrent) setRelatedSeasons(seasons); })
            .catch(() => {});
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu phim:", error);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    fetchMovieData();
    return () => { isCurrent = false; };
  }, [id]);

  // Đã xem dở phim này chưa -> nút chính thành "Xem tiếp tập X"
  useEffect(() => {
    setHistory(null);
    if (!user?.uid || !id) return;
    let isCurrent = true;
    getDoc(doc(db, "users", user.uid, "watchHistory", id))
      .then((snap) => { if (isCurrent && snap.exists()) setHistory(snap.data()); })
      .catch(() => {});
    return () => { isCurrent = false; };
  }, [id, user?.uid]);

  const goToEpisode = (ep, serverIndex = selectedServerIndex, cloudProgress = null) => {
    if (!ep) return;
    navigate(`/play/${id}`, {
      state: {
        videoUrl: ep.link_m3u8 || ep.m3u8 || "",
        embedFallback: ep.link_embed || ep.embed || "",
        movieName: movieDetails.name,
        epName: ep.name,
        allServers: movieServers,
        currentServerIndex: serverIndex,
        posterUrl: getFullImageUrl(movieDetails.poster_url),
        cloudProgress,
      }
    });
  };

  if (loading) return showSkeleton ? <DetailSkeleton /> : <div className="min-h-screen" />;
  if (!movieDetails) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 pt-16 text-center">
        <span className="material-symbols-outlined mb-3 text-[40px] text-fg-3">movie</span>
        <h1 className="text-lg font-semibold text-fg">Không tìm thấy phim này</h1>
        <p className="mt-1 text-sm text-fg-2">Phim có thể đã bị gỡ khỏi nguồn hoặc đường dẫn bị sai.</p>
        <Link to="/" className="mt-5 flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-fg hover:bg-white/5">Về trang chủ</Link>
      </main>
    );
  }

  // LẤY DỮ LIỆU AN TOÀN BAO THẦU CẢ 2 CHUẨN KKPHIM & NGUONC
  const rawEpisodes = movieServers[selectedServerIndex]?.server_data || movieServers[selectedServerIndex]?.items || [];
  const currentEpisodes = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  // Tập đang xem dở (tìm ở mọi server)
  let resumeTarget = null;
  if (history?.epName) {
    for (let i = 0; i < movieServers.length; i++) {
      const eps = movieServers[i]?.server_data || movieServers[i]?.items || [];
      const found = eps.find((e) => e.name === history.epName);
      if (found) { resumeTarget = { ep: found, serverIndex: i }; break; }
    }
  }

  const handlePrimary = () => {
    if (resumeTarget) return goToEpisode(resumeTarget.ep, resumeTarget.serverIndex, history.progress || null);
    if (currentEpisodes.length > 0) return goToEpisode(currentEpisodes[0]);
    showToast("Phim này chưa có tập nào để xem, bạn quay lại sau nhé!", "error");
  };

  const saved = isSaved(id);
  const description = decodeHtmlText(movieDetails.content);
  const meta = [movieDetails.year, movieDetails.time, movieDetails.quality, movieDetails.lang].filter(Boolean);
  const countries = Array.isArray(movieDetails.country) ? movieDetails.country.map((c) => c.name).join(", ") : "";
  const directors = Array.isArray(movieDetails.director) ? movieDetails.director.filter(Boolean).join(", ") : "";
  const actors = Array.isArray(movieDetails.actor) ? movieDetails.actor.filter(Boolean).join(", ") : "";
  const infoRows = [
    ["Tình trạng", movieDetails.episode_current],
    ["Quốc gia", countries],
    ["Đạo diễn", directors],
    ["Diễn viên", actors],
  ].filter(([, v]) => v);

  return (
    <main className="pb-24">
      <TrailerModal isOpen={isTrailerOpen} onClose={() => setIsTrailerOpen(false)} youtubeKey={trailerKey} />

      {/* Ảnh nền */}
      <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden md:h-[56vh]">
        <img
          className="h-full w-full object-cover object-top opacity-50"
          src={getFullImageUrl(movieDetails.thumb_url || movieDetails.poster_url)}
          onError={(e) => {
            if (movieDetails.poster_url && e.currentTarget.src !== getFullImageUrl(movieDetails.poster_url)) {
              e.currentTarget.src = getFullImageUrl(movieDetails.poster_url);
            }
          }}
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-canvas/10" />
      </div>

      <div className="relative mx-auto -mt-44 max-w-container-max px-4 sm:px-6 md:-mt-56">
        <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10 lg:grid-cols-[260px_1fr]">
          {/* Poster */}
          <div className="mx-auto w-40 md:mx-0 md:w-full">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-card ring-1 ring-white/10">
              <img
                src={getFullImageUrl(movieDetails.poster_url || movieDetails.thumb_url)}
                onError={(e) => {
                  const altSrc = getFullImageUrl(movieDetails.thumb_url);
                  if (movieDetails.thumb_url && e.currentTarget.src !== altSrc) e.currentTarget.src = altSrc;
                  else e.currentTarget.src = FALLBACK_POSTER;
                }}
                className="h-full w-full object-cover"
                alt={movieDetails.name}
              />
            </div>
          </div>

          {/* Thông tin + hành động */}
          <div className="min-w-0 md:pt-16">
            <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-fg md:text-left md:text-4xl">{movieDetails.name}</h1>
            {movieDetails.origin_name && movieDetails.origin_name !== movieDetails.name && (
              <p className="mt-1.5 text-center text-sm text-fg-2 md:text-left">{movieDetails.origin_name}</p>
            )}

            {meta.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-fg-2 md:justify-start">
                {meta.map((m, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-fg-3" aria-hidden="true">·</span>}
                    {m}
                  </span>
                ))}
              </p>
            )}

            {Array.isArray(movieDetails.category) && movieDetails.category.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:justify-start">
                {movieDetails.category.map((cat) => (
                  <Link
                    key={cat.id || cat.slug}
                    to="/search"
                    state={{ type: "the-loai", slug: cat.slug, title: cat.name }}
                    className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-fg-2 transition-colors hover:bg-white/10 hover:text-fg"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Hành động: một nút chính màu nhấn, còn lại nút viền */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
              <button
                onClick={handlePrimary}
                className="btn-primary flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold"
              >
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                {resumeTarget
                  ? (/^Tập \d+$/.test(episodeLabel(resumeTarget.ep.name)) && currentEpisodes.length > 1
                      ? `Xem tiếp ${episodeLabel(resumeTarget.ep.name).toLowerCase()}`
                      : "Xem tiếp")
                  : "Xem ngay"}
              </button>
              <OutlineButton onClick={handleWatchTrailer} disabled={isTrailerLoading || noTrailer} title={noTrailer ? "Phim này chưa có trailer" : "Xem trailer"}>
                <span className={`material-symbols-outlined text-[20px] ${isTrailerLoading ? "animate-spin motion-reduce:animate-none" : ""}`}>
                  {isTrailerLoading ? "progress_activity" : noTrailer ? "videocam_off" : "smart_display"}
                </span>
                {noTrailer ? "Chưa có trailer" : "Trailer"}
              </OutlineButton>
              <OutlineButton
                onClick={() => (saved ? removeFromWatchlist(id) : addToWatchlist({ slug: id, name: movieDetails.name, thumb_url: getFullImageUrl(movieDetails.thumb_url), year: movieDetails.year }))}
                aria-pressed={saved}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: saved ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                {saved ? "Đã lưu" : "Lưu phim"}
              </OutlineButton>
            </div>

            {/* Nội dung */}
            {description && (
              <div className="mt-6 max-w-3xl">
                <p className={`whitespace-pre-line text-sm leading-relaxed text-fg-2 md:text-[15px] ${isDescExpanded ? "" : "line-clamp-3"}`}>{description}</p>
                {description.length > 220 && (
                  <button onClick={() => setIsDescExpanded((v) => !v)} className="mt-1 h-8 text-sm font-medium text-fg hover:underline">
                    {isDescExpanded ? "Thu gọn" : "Xem thêm"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tập phim */}
        <section className="mt-12" aria-labelledby="episodes-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="episodes-heading" className="text-lg font-semibold text-fg">
              Danh sách tập <span className="ml-1 text-sm font-normal text-fg-3">{currentEpisodes.length}</span>
            </h2>

            {/* Máy chủ: chỉ hiện khi có từ 2 bản trở lên */}
            {movieServers.length > 1 && (
              <div className="scrollbar-clean flex max-w-full gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1" role="tablist" aria-label="Phiên bản">
                {movieServers.map((server, index) => (
                  <button
                    key={index}
                    role="tab"
                    aria-selected={selectedServerIndex === index}
                    onClick={() => setSelectedServerIndex(index)}
                    className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${selectedServerIndex === index ? "bg-white/10 font-medium text-fg" : "text-fg-2 hover:text-fg"}`}
                  >
                    {server.server_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Các phần / movie liên quan */}
          {relatedSeasons.length > 1 && (
            <div className="scrollbar-clean -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {relatedSeasons.map((season) => {
                const isActive = season.id === id;
                return (
                  <button
                    key={season.id}
                    onClick={() => !isActive && navigate(`/movie/${season.id}`)}
                    aria-current={isActive ? "page" : undefined}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors ${isActive ? "bg-fg font-medium text-canvas" : "border border-line-strong text-fg-2 hover:bg-white/5 hover:text-fg"}`}
                  >
                    {season.label || `Phần ${season.seasonNumber}`}
                  </button>
                );
              })}
            </div>
          )}

          {currentEpisodes.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {currentEpisodes.map((ep, idx) => {
                const isWatching = history?.epName === ep.name;
                return (
                  <button
                    key={`${ep.slug || ep.name}-${idx}`}
                    onClick={() => goToEpisode(ep, selectedServerIndex, isWatching ? history.progress || null : null)}
                    className={`relative h-10 truncate rounded-lg px-2 text-sm tabular-nums transition-colors ${isWatching ? "bg-brand/15 font-medium text-fg ring-1 ring-brand/50" : "bg-white/[0.05] text-fg-2 hover:bg-white/10 hover:text-fg"}`}
                    title={isWatching ? "Bạn đang xem dở tập này" : undefined}
                  >
                    {String(ep.name || "").replace(/tập/gi, "").replace(/:/g, "").trim() || ep.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-line px-4 py-6 text-center text-sm text-fg-2">Phim chưa có tập nào ở phiên bản này.</p>
          )}
        </section>

        {/* Thông tin */}
        {infoRows.length > 0 && (
          <section className="mt-12" aria-labelledby="info-heading">
            <h2 id="info-heading" className="mb-4 text-lg font-semibold text-fg">Thông tin</h2>
            <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              {infoRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[96px_1fr] gap-3">
                  <dt className="text-fg-3">{label}</dt>
                  <dd className="text-fg-2">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Bình luận */}
        <section className="mt-12">
          <CommentSection movieId={id} movieName={movieDetails.name} />
        </section>
      </div>
    </main>
  );
}
