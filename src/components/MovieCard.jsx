import { Link } from "react-router-dom";

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movie/${movie.id}`} className="group cursor-pointer block">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 transition-all duration-300 transform group-hover:scale-[1.02] group-hover:-translate-y-1 group-hover:shadow-[0_10px_30px_-10px_rgba(143,136,199,0.5)]">
        <img
          alt={movie.title}
          className="w-full h-full object-cover"
          src={movie.image}
        />
        {movie.is4K && (
          <div className="absolute top-2 right-2 bg-primary text-on-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">
            4K
          </div>
        )}
        <div className="absolute inset-0 bg-transparent group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/90 text-on-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(199,191,255,0.5)]">
            <span className="material-symbols-outlined ml-1">play_arrow</span>
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-medium text-white">
          {movie.duration}
        </div>
      </div>
      <h4 className="font-label-md text-[14px] text-text-primary group-hover:text-primary transition-colors truncate">
        {movie.title}
      </h4>
      <p className="font-label-sm text-[12px] text-text-secondary">
        {movie.year} • {movie.genre}
      </p>
    </Link>
  );
}