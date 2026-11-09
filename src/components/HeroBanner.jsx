import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiGetMovieLogo, apiGetPhimDetail } from "../api/api";

const SLIDE_MS = 9000;

export default function HeroBanner({ movies = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logoUrl, setLogoUrl] = useState(null);
  const [description, setDescription] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  // Danh sách phim đổi (cache cũ -> dữ liệu mới ít phim hơn) thì về slide đầu, tránh crash
  const safeIndex = currentIndex < movies.length ? currentIndex : 0;
  const currentMovieId = movies[safeIndex]?.id;

  // Logo phim + mô tả thật khi đổi slide
  useEffect(() => {
    const movie = movies[safeIndex];
    if (!movie) return;
    let isMounted = true;
    setLogoUrl(null);
    setDescription(movie.description || "");

    (async () => {
      try {
        const [logo, detailRes] = await Promise.all([
          apiGetMovieLogo(movie.origin_name || movie.title || movie.name),
          !movie.description && movie.id ? apiGetPhimDetail(movie.id) : Promise.resolve(null),
        ]);
        if (!isMounted) return;
        if (logo) setLogoUrl(logo);
        if (detailRes?.movie?.content) setDescription(detailRes.movie.content.replace(/<[^>]*>?/gm, ""));
      } catch {}
    })();

    return () => { isMounted = false; };
    // Chỉ chạy lại khi phim đang hiển thị thực sự đổi (không phải mỗi lần trang chủ vẽ lại)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMovieId]);

  // Tự chuyển slide; rê chuột vào banner thì dừng
  useEffect(() => {
    if (movies.length <= 1 || isPaused) return;
    const timer = setInterval(() => setCurrentIndex((prev) => (prev + 1) % movies.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [movies.length, isPaused]);

  if (!movies.length) return null;
  const movie = movies[safeIndex];
  const title = movie.title || movie.name;
  const meta = [movie.year, movie.quality, movie.lang].filter(Boolean).join(" · ");

  return (
    <section
      // Chiều cao TỐI THIỂU thay vì cố định + chừa chỗ cho header (pt-24): màn thấp thì banner tự cao thêm,
      // chữ không bao giờ trượt lên nằm dưới thanh header
      className="relative flex min-h-[62vh] w-full items-end overflow-hidden pt-24 md:min-h-[78vh]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Phim nổi bật"
    >
      {/* Ảnh nền: render SẴN ảnh của mọi slide, xếp chồng, chỉ đổi độ mờ.
          Trước đây ảnh slide nào chỉ bắt đầu tải khi tới slide đó -> mỗi lần chuyển là màn đen chờ ảnh. */}
      <div className="absolute inset-0 bg-canvas">
        {movies.map((m, i) => (
          <img
            key={`${m.id}-${i}`}
            src={m.thumb_url || m.image}
            alt=""
            loading="eager"
            fetchPriority={i === safeIndex ? "high" : "low"}
            decoding="async"
            aria-hidden={i !== safeIndex}
            className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ease-out ${i === safeIndex ? "hero-zoom opacity-100" : "opacity-0"}`}
          />
        ))}
        {/* Lớp phủ để chữ luôn đọc được (đo ở chỗ ảnh sáng nhất) */}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/45 to-canvas/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/40 to-transparent" />
      </div>

      <style>{`
        @keyframes heroZoom { from { transform: scale(1.05) } to { transform: scale(1) } }
        .hero-zoom { animation: heroZoom 6s cubic-bezier(.16,1,.3,1) both; }
        @media (prefers-reduced-motion: reduce) { .hero-zoom { animation: none } }
      `}</style>

      <div className="relative mx-auto w-full max-w-container-max px-4 pb-12 sm:px-6 md:pb-20">
        <div className="max-w-xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-fg-2">
            Top {safeIndex + 1} thịnh hành
          </p>

          {logoUrl ? (
            <>
              <img src={logoUrl} alt={title} className="mb-3 max-h-[110px] w-auto max-w-[320px] object-contain object-left md:max-h-[140px] md:max-w-[420px]" />
              <h2 className="sr-only">{title}</h2>
            </>
          ) : (
            <h2 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-fg md:text-5xl">{title}</h2>
          )}

          {meta && <p className="mb-3 text-sm text-fg-2">{logoUrl ? `${title} · ${meta}` : meta}</p>}

          {(description || movie.description) && (
            <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-fg/80 md:line-clamp-3 md:text-base">
              {description || movie.description}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Link
              to={`/movie/${movie.id}`}
              className="btn-primary flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              Xem ngay
            </Link>
            <Link
              to={`/movie/${movie.id}`}
              className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-medium text-fg transition-colors hover:bg-white/15"
            >
              <span className="material-symbols-outlined text-[20px]">info</span>
              Chi tiết
            </Link>
          </div>
        </div>

        {/* Chỉ báo slide */}
        {movies.length > 1 && (
          <div className="mt-8 flex gap-1.5" role="tablist" aria-label="Chọn phim nổi bật">
            {movies.map((m, i) => (
              <button
                key={`${m.id}-${i}`}
                role="tab"
                aria-selected={i === safeIndex}
                aria-label={`Phim ${i + 1}: ${m.title || m.name}`}
                onClick={() => setCurrentIndex(i)}
                className="group/dot flex h-6 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className={`block h-1 rounded-full transition-all duration-300 ${i === safeIndex ? "w-8 bg-fg" : "w-4 bg-white/30 group-hover/dot:bg-white/50"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
