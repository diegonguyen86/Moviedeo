import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function AdminTrending() {
  const [slugInput, setSlugInput] = useState("");
  const [trendingList, setTrendingList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lấy danh sách Top Trending hiện tại từ Firebase
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const docRef = doc(db, "admin_settings", "top_trending");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTrendingList(docSnap.data().movies || []);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách:", error);
      }
    };
    fetchTrending();
  }, []);

  // Hàm xử lý khi Khôi bấm "Thêm Phim"
  const handleAddMovie = async () => {
    if (!slugInput.trim()) return;
    setIsLoading(true);

    try {
      // 1. Dùng slug Khôi nhập để chọc vào API của KKPhim lấy thông tin chuẩn
      const response = await fetch(`https://phimapi.com/phim/${slugInput}`);
      const data = await response.json();

      if (!data || !data.status) {
        alert("Không tìm thấy phim với slug này trên KKPhim!");
        setIsLoading(false);
        return;
      }

      // 2. Rút trích thông tin cần thiết
      const newMovie = {
        slug: data.movie.slug,
        name: data.movie.name,
        origin_name: data.movie.origin_name,
        thumb_url: data.movie.thumb_url,
        poster_url: data.movie.poster_url,
        year: data.movie.year,
      };

      // 3. Cập nhật vào danh sách hiện tại
      const updatedList = [newMovie, ...trendingList];
      setTrendingList(updatedList);
      
      // 4. Lưu ngược lên Firebase
      const docRef = doc(db, "admin_settings", "top_trending");
      await setDoc(docRef, { movies: updatedList });

      setSlugInput("");
      alert("Đã thêm phim lên Top Trending thành công!");
    } catch (error) {
      alert("Có lỗi xảy ra khi gọi API KKPhim.");
    }
    setIsLoading(false);
  };

  // Hàm xóa phim khỏi Top Trending
  const handleRemoveMovie = async (slugToRemove) => {
    const updatedList = trendingList.filter(movie => movie.slug !== slugToRemove);
    setTrendingList(updatedList);
    
    const docRef = doc(db, "admin_settings", "top_trending");
    await setDoc(docRef, { movies: updatedList });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-10">
      <h1 className="text-3xl font-black mb-6 uppercase text-yellow-500">Quản lý Top Trending</h1>
      
      {/* KHU VỰC NHẬP LIỆU */}
      <div className="bg-white/10 p-6 rounded-2xl mb-8 flex gap-4 max-w-2xl">
        <input 
          type="text" 
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
          placeholder="Nhập slug từ KKPhim (vd: venom-keo-cuoi)..." 
          className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
        />
        <button 
          onClick={handleAddMovie}
          disabled={isLoading}
          className="bg-yellow-500 text-black font-black px-6 py-3 rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50"
        >
          {isLoading ? "Đang tìm..." : "Thêm Phim"}
        </button>
      </div>

      {/* DANH SÁCH PHIM ĐANG HIỂN THỊ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {trendingList.map((movie, index) => (
          <div key={index} className="relative bg-white/5 rounded-xl overflow-hidden border border-white/10 group">
            <img src={movie.thumb_url} alt={movie.name} className="w-full aspect-[2/3] object-cover" />
            <div className="p-3">
              <h3 className="font-bold text-sm truncate">{movie.name}</h3>
              <p className="text-xs text-zinc-400 truncate">{movie.slug}</p>
            </div>
            
            {/* Nút Xóa (hiện khi hover) */}
            <button 
              onClick={() => handleRemoveMovie(movie.slug)}
              className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
