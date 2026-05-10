import { useRef } from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard";

export default function MovieCarousel({ title, movies, viewAllState }) {
  const rowRef = useRef(null);

  const scrollLeft = () => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: -rowRef.current.offsetWidth + 100, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (rowRef.current) {
      rowRef.current.scrollBy({ left: rowRef.current.offsetWidth - 100, behavior: 'smooth' });
    }
  };

  return (
    <section className="mt-8 px-6 max-w-container-max mx-auto w-full relative group/carousel">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline-md text-[24px] font-semibold text-text-primary">
          {title}
        </h3>
        {viewAllState && (
          <Link 
            to="/search"
            state={viewAllState}
            className="text-primary font-label-md text-[14px] hover:text-primary-fixed transition-colors flex items-center gap-1 group"
          >
            Xem tất cả
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        )}
      </div>
      
      <div className="relative">
        <button 
          onClick={scrollLeft}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-surface-glass/80 backdrop-blur-md rounded-full flex items-center justify-center text-text-primary opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 hover:bg-primary hover:text-on-primary shadow-lg border border-border-glass cursor-pointer"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        <div 
          ref={rowRef}
          className="flex gap-4 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory pt-2 pb-6"
        >
          {movies.map((movie) => (
            <div key={movie.id} className="w-[130px] md:w-[160px] lg:w-[180px] shrink-0 snap-start">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>

        <button 
          onClick={scrollRight}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-surface-glass/80 backdrop-blur-md rounded-full flex items-center justify-center text-text-primary opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 hover:bg-primary hover:text-on-primary shadow-lg border border-border-glass cursor-pointer"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </section>
  );
}
