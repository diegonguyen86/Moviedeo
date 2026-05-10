import { Link } from "react-router-dom";

export default function HeroBanner({ movie }) {
  if (!movie) return null;

  return (
    <section className="relative w-full h-[707px] flex items-end">
      <div className="absolute inset-0 z-0">
        <img
          alt={movie.title}
          className="w-full h-full object-cover"
          src={movie.image}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent"></div>
      </div>
      <div className="relative z-10 px-6 pb-12 w-full max-w-container-max mx-auto">
        <div className="space-y-4 max-w-md">
          <div className="flex items-center gap-2">
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full font-label-sm text-[12px] border border-primary/30 uppercase tracking-widest">
              Trending Now
            </span>
          </div>
          <h2 className="font-display-md text-[40px] leading-tight font-bold text-text-primary">
            {movie.title}
          </h2>
          <p className="text-text-secondary font-body-md text-[16px] line-clamp-2">
            {movie.description}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link to={`/movie/${movie.id}`} className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-[14px] hover:bg-primary-fixed transition-colors active:scale-95">
              <span className="material-symbols-outlined filled">play_arrow</span>
              Phát ngay
            </Link>
            <Link to={`/movie/${movie.id}`} className="flex items-center gap-2 bg-surface-glass text-text-primary px-6 py-3 rounded-full font-label-md text-[14px] border border-border-glass hover:bg-surface-glass/80 transition-colors active:scale-95 backdrop-blur-sm">
              <span className="material-symbols-outlined">info</span>
              Chi tiết
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}