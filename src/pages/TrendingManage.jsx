import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function AdminTrending() {
  const [trendingList, setTrendingList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Tham chiếu dùng cho tính năng Kéo thả (Drag & Drop)
  const dragItem = useRef();
  const dragOverItem = useRef();

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

  // 🚀 HÀM XỬ LÝ ĐỒNG BỘ TỰ ĐỘNG TỪ TMDB
  const handleAutoFetch = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/cron-trending");
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        setTrendingList(data.movies);
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (error) {
      alert("Lỗi kết nối tới Server API.");
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm xóa phim khỏi Top Trending
  const handleRemoveMovie = async (slugToRemove) => {
    const updatedList = trendingList.filter(movie => movie.slug !== slugToRemove);
    setTrendingList(updatedList);
    
    const docRef = doc(db, "admin_settings", "top_trending");
    await setDoc(docRef, { movies: updatedList });
  };

  // 🚀 HÀM XỬ LÝ KHI THẢ CHUỘT (Cập nhật vị trí)
  const handleSort = async () => {
    // Clone danh sách hiện tại
    let _trendingList = [...trendingList];
    
    // Cắt phần tử đang kéo ra
    const draggedItemContent = _trendingList.splice(dragItem.current, 1)[0];
    
    // Chèn phần tử đó vào vị trí mới (vị trí đang hover)
    _trendingList.splice(dragOverItem.current, 0, draggedItemContent);
    
    // Reset lại refs
    dragItem.current = null;
    dragOverItem.current = null;
    
    // Cập nhật State cho UI
    setTrendingList(_trendingList);
    
    // Lưu thứ tự mới lên Firebase
    const docRef = doc(db, "admin_settings", "top_trending");
    await setDoc(docRef, { movies: _trendingList });
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-black mb-6 uppercase text-yellow-500">Quản lý Top Trending</h1>
      
      {/* KHU VỰC ĐỒNG BỘ TỰ ĐỘNG TỪ TMDB */}
      <div className="bg-white/10 p-6 rounded-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Đồng Bộ TMDB Tự Động</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Hệ thống sẽ tự động quét và cập nhật Top Trending vào 7:00 sáng mỗi ngày. <br/>
            Bạn cũng có thể bấm làm mới ngay lập tức (Lưu ý: sẽ thay thế toàn bộ danh sách hiện tại).
          </p>
        </div>
        <button 
          onClick={handleAutoFetch}
          disabled={isLoading}
          className="bg-yellow-500 text-black font-black px-6 py-3 rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 h-fit whitespace-nowrap flex items-center gap-2"
        >
          {isLoading ? "⏳ Đang quét TMDB..." : "🔄 Làm mới ngay"}
        </button>
      </div>

      {/* DANH SÁCH PHIM KÉO THẢ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {trendingList.map((movie, index) => (
          <div 
            key={movie.slug} // Dùng slug làm key thay vì index để React render lại chuẩn khi kéo
            draggable
            onDragStart={(e) => (dragItem.current = index)}
            onDragEnter={(e) => (dragOverItem.current = index)}
            onDragEnd={handleSort}
            onDragOver={(e) => e.preventDefault()} // Bắt buộc phải có để cho phép thả chuột
            className="relative bg-white/5 rounded-xl overflow-hidden border border-white/10 group cursor-grab active:cursor-grabbing hover:border-yellow-500/50 transition-colors"
          >
            {/* Ảnh Phim */}
            <img src={movie.thumb_url} alt={movie.name} className="w-full aspect-[2/3] object-cover pointer-events-none" />
            
            {/* Thông tin Phim */}
            <div className="p-3 bg-black/80 absolute bottom-0 w-full">
              <h3 className="font-bold text-sm truncate">{movie.name}</h3>
              <p className="text-xs text-zinc-400 truncate">{movie.slug}</p>
            </div>
            
            {/* Icon Kéo thả (Gợi ý cho người dùng biết có thể kéo) */}
            <div className="absolute top-2 left-2 bg-black/60 text-white/50 p-1 rounded-md backdrop-blur-md">
              <span className="material-symbols-outlined text-sm">drag_indicator</span>
            </div>
            
            {/* Nút Xóa (hiện khi hover) */}
            <button 
              onClick={() => handleRemoveMovie(movie.slug)}
              className="absolute top-2 right-2 bg-red-600/90 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
