import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard";

// Ô icon theo loại hàng (Sắc phân loại, evon P17): một loại một màu cố định trên mọi màn
const TONE_CLASS = {
  1: "bg-cat-1/15 text-cat-1",
  2: "bg-cat-2/15 text-cat-2",
  3: "bg-cat-3/15 text-cat-3",
  4: "bg-cat-4/15 text-cat-4",
};

// ranked: hàng xếp hạng kiểu Netflix (Top 15) — số thứ tự to viền chữ đứng bên trái mỗi poster
export default function MovieCarousel({ title, movies, viewAllState, icon, tone, ranked = false }) {
  const rowRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Kéo để cuộn bằng chuột (máy tính)
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const dragDistance = useRef(0);

  const updateArrows = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [movies]);

  const scrollByPage = (dir) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse") return; // chạm thì để trình duyệt tự cuộn
    setIsDragging(true);
    startX.current = e.clientX;
    startScroll.current = rowRef.current.scrollLeft;
    dragDistance.current = 0;
  };
  const onPointerMove = (e) => {
    if (!isDragging) return;
    const walk = e.clientX - startX.current;
    dragDistance.current = Math.abs(walk);
    rowRef.current.scrollLeft = startScroll.current - walk;
  };
  const endDrag = () => setIsDragging(false);
  // Vừa kéo xong thì không tính là bấm vào phim
  const onClickCapture = (e) => {
    if (dragDistance.current > 6) {
      e.stopPropagation();
      e.preventDefault();
      dragDistance.current = 0;
    }
  };

  if (!movies || movies.length === 0) return null;

  const arrowClass =
    "absolute top-[calc(50%-28px)] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-raised/95 text-fg transition-opacity hover:bg-raised md:flex";

  return (
    <section className="group/row mx-auto w-full max-w-container-max px-4 sm:px-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h3 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-fg">
          {icon && (
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_CLASS[tone] || "bg-white/10 text-fg-2"}`} aria-hidden="true">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            </span>
          )}
          {title}
        </h3>
        {viewAllState && (
          <Link
            to="/search"
            state={viewAllState}
            className="flex h-8 shrink-0 items-center gap-0.5 text-sm text-fg-2 transition-colors hover:text-fg"
          >
            Xem tất cả
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </Link>
        )}
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button onClick={() => scrollByPage(-1)} className={`${arrowClass} -left-4 opacity-0 group-hover/row:opacity-100`} aria-label="Cuộn sang trái">
            <span className="material-symbols-outlined text-[22px]">chevron_left</span>
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={updateArrows}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onDragStart={(e) => e.preventDefault()}
          onClickCapture={onClickCapture}
          className={`scrollbar-clean -mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 ${isDragging ? "cursor-grabbing select-none" : ""}`}
        >
          {movies.map((movie, index) => (
            ranked ? (
              <div key={`${movie.id}-${index}`} className="flex shrink-0 snap-start items-end">
                <span
                  aria-hidden="true"
                  className="-mr-3 select-none pb-14 text-[88px] font-black leading-none tracking-tighter text-canvas sm:-mr-4 sm:text-[112px] lg:text-[132px]"
                  style={{ WebkitTextStroke: "2px rgba(255,255,255,0.55)" }}
                >
                  {index + 1}
                </span>
                <div className="relative z-[1] w-[112px] sm:w-[132px] lg:w-[156px]">
                  <MovieCard movie={movie} />
                </div>
              </div>
            ) : (
              <div key={`${movie.id}-${index}`} className="w-[132px] shrink-0 snap-start sm:w-[156px] lg:w-[184px]">
                <MovieCard movie={movie} />
              </div>
            )
          ))}
        </div>

        {canScrollRight && (
          <button onClick={() => scrollByPage(1)} className={`${arrowClass} -right-4 opacity-0 group-hover/row:opacity-100`} aria-label="Cuộn sang phải">
            <span className="material-symbols-outlined text-[22px]">chevron_right</span>
          </button>
        )}
      </div>
    </section>
  );
}
