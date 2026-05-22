import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function AdminTrending() {
  const [slugInput, setSlugInput] = useState("");
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

  // 🚀 HÀM XỬ LÝ NHẬP SỈ (BULK ADD)
  const handleAddBatch = async () => {
    // Tách chuỗi thành mảng các slug (xuống dòng hoặc dấu phẩy)
    const slugs = slugInput.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    
    if (slugs.length === 0) return;
    setIsLoading(true);

    try {
      const fetchPromises = slugs.map(slug => 
        fetch(`https://phimapi.com/phim/${slug}`).then(res => res.json())
      );
      
      const results = await Promise.allSettled(fetchPromises);
      const newMovies = [];
      const failedSlugs = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.status) {
          const movieData = result.value.movie;
          newMovies.push({
            slug: movieData.slug,
            name: movieData.name,
            origin_name: movieData.origin_name,
            thumb_url: movieData.thumb_url,
            poster_url: movieData.poster_url,
            year: movieData.year,
          });
        } else {
          failedSlugs.push(slugs[index]);
        }
      });

      if (newMovies.length > 0) {
        const updatedList = [...trendingList, ...newMovies]; // Thêm phim mới vào cuối danh sách
        setTrendingList(updatedList);
        
        const docRef = doc(db, "admin_settings", "top_trending");
        await setDoc(docRef, { movies: updatedList });

        if (failedSlugs.length === 0) {
          setSlugInput("");
          alert(`Đã thêm thành công ${newMovies.length} phim!`);
        } else {
          setSlugInput(failedSlugs.join("\n"));
          alert(`Đã thêm ${newMovies.length} phim. Có ${failedSlugs.length} slug bị lỗi!`);
        }
      } else {
        alert("Toàn bộ slug đều bị lỗi hoặc không tồn tại!");
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi gọi API KKPhim.");
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
    <div className="min-h-screen bg-[#050505] text-white p-10">
      <h1 className="text-3xl font-black mb-6 uppercase text-yellow-500">Quản lý Top Trending</h1>
      
      {/* KHU VỰC NHẬP LIỆU (Đã nâng cấp thành Textarea nhập sỉ) */}
      <div className="bg-white/10 p-6 rounded-2xl mb-8 flex flex-col md:flex-row gap-4 max-w-2xl">
        <textarea 
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
          placeholder="Dán list slug từ Terminal vào đây (Mỗi slug 1 dòng)..." 
          className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 min-h-[120px] resize-y"
        />
        <button 
          onClick={handleAddBatch}
          disabled={isLoading}
          className="bg-yellow-500 text-black font-black px-6 py-3 rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 h-fit whitespace-nowrap"
        >
          {isLoading ? "Đang xử lý..." : "Thêm Hàng Loạt"}
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
