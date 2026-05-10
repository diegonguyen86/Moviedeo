import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movieDetails, setMovieDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        const response = await fetch(`/api/film/${id}`);
        const data = await response.json();
        if (data.status === "success") {
          setMovieDetails(data.movie);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu phim:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMovieData();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-white font-bold animate-pulse">Đang chuẩn bị rạp phim...</div>;
  if (!movieDetails) return <div className="p-12 text-center text-white font-bold">Không tìm thấy phim này rồi!</div>;

  return (
    <main className="pb-20 bg-black min-h-screen text-white">
      {/* 1. Banner đầu trang */}
      <section className="relative w-full h-[50vh] md:h-[65vh]">
        <img 
          className="w-full h-full object-cover opacity-30 scale-105" 
          src={movieDetails.poster_url} 
          alt={movieDetails.name} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 flex items-end px-6 md:px-20 pb-16">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter drop-shadow-2xl">
              {movieDetails.name}
            </h1>
            <div className="flex flex-wrap gap-3">
              <span className="bg-white text-black px-3 py-1 rounded-md text-xs font-black">
                {movieDetails.year}
              </span>
              <span className="bg-primary px-3 py-1 rounded-md text-xs font-black uppercase">
                {movieDetails.quality}
              </span>
              <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-md text-xs font-bold">
                {movieDetails.language}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Phần nội dung chi tiết */}
      <section className="px-6 md:px-20 py-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        
        {/* Cột trái: Poster */}
        <div className="md:col-span-1">
          <div className="sticky top-28">
            <img 
              src={movieDetails.thumb_url} 
              className="w-full rounded-2xl border border-white/5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)]" 
              alt="Poster"
            />
          </div>
        </div>

        {/* Cột phải: Thông tin & Danh sách tập */}
        <div className="md:col-span-3 space-y-12">
          
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold border-l-4 border-primary pl-4 uppercase tracking-wider">Nội dung phim</h2>
              <p className="text-zinc-400 leading-relaxed text-lg italic bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                "{movieDetails.description}"
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12 text-sm bg-zinc-900/20 p-8 rounded-2xl border border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Đạo diễn</span> 
                <span className="text-zinc-200 text-base">{movieDetails.director || "Đang cập nhật"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Năm phát hành</span> 
                <span className="text-zinc-200 text-base">{movieDetails.year}</span>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Diễn viên</span> 
                <span className="text-zinc-200 text-base leading-relaxed">{movieDetails.casts || "Đang cập nhật"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Thời lượng</span> 
                <span className="text-zinc-200 text-base">{movieDetails.time || "Đang cập nhật"}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 shadow-inner">
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
              <span className="material-symbols-outlined text-primary">playlist_play</span>
              <h3 className="text-xl font-bold uppercase tracking-tight">Chọn tập phim</h3>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {movieDetails.episodes?.[0]?.items.map((ep) => (
                <button
                  key={ep.slug}
                  onClick={() => {
                    navigate(`/play/${movieDetails.slug}`, { 
                      state: { 
                        embedUrl: ep.embed, 
                        movieName: movieDetails.name, 
                        epName: ep.name,
                        allEpisodes: movieDetails.episodes?.[0]?.items,
                        posterUrl: movieDetails.poster_url // Dòng quan trọng gửi sang VideoPlayer
                      } 
                    });
                  }}
                  className="min-w-[65px] h-12 px-4 flex items-center justify-center bg-zinc-800 hover:bg-primary text-zinc-300 hover:text-white rounded-xl font-bold transition-all duration-300 border border-white/5 hover:border-primary hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] hover:-translate-y-1"
                >
                  {ep.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}