import { Link } from "react-router-dom";
import MovieCard from "./MovieCard";

export default function MovieGrid({ title, movies, viewAllState }) {
  return (
    <section className="mt-8 px-6 max-w-container-max mx-auto w-full">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}