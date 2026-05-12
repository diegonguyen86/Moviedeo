import axios from "axios";

// CHỈNH SỬA: Luôn dùng /api để lách luật CORS qua Netlify Proxy
const baseURL = '/api'; 
const apiClient = axios.create({ baseURL });

// --- LOGIC CACHE (Lưu 1 ngày để web mượt, giữ nguyên khi tắt trình duyệt) ---
const CACHE_TIME = 24 * 60 * 60 * 1000; // 24 giờ x 60 phút x 60 giây x 1000 ms
const getCachedData = (key) => {
  // Dùng localStorage thay vì sessionStorage
  const cached = localStorage.getItem("cache_" + key);
  if (!cached) return null;
  
  const { data, timestamp } = JSON.parse(cached);
  
  // Nếu dữ liệu đã cũ hơn 1 ngày, dọn rác và báo là chưa có cache
  if (Date.now() - timestamp > CACHE_TIME) {
    localStorage.removeItem("cache_" + key);
    return null;
  }
  return data;
};
const setCachedData = (key, data) => {
  // Dùng localStorage để lưu
  localStorage.setItem("cache_" + key, JSON.stringify({ data, timestamp: Date.now() }));
};

// Hàm GET an toàn
const safeGet = async (url) => {
  const cached = getCachedData(url);
  if (cached) return cached;
  try {
    const res = await apiClient.get(url);
    if (res.data) { 
        setCachedData(url, res.data); 
        return res.data; 
    }
  } catch (error) {
    console.error("API Error:", url);
    return { status: "success", items: [], data: { item: [] } }; 
  }
};

// --- CÁC HÀM EXPORT (Đã có đầy đủ cả hàm Search by Title) ---
export const apiGetPhimMoiCapNhat = (page = 1) => safeGet(`/films/phim-moi-cap-nhat?page=${page}`);
export const apiGetPhimTheoDanhSach = (slug, page = 1) => safeGet(`/films/danh-sach/${slug}?page=${page}`);
export const apiGetPhimDetail = (slug) => safeGet(`/film/${slug}`);
export const apiGetPhimTheoTheLoai = (slug, page = 1) => safeGet(`/films/the-loai/${slug}?page=${page}`);
export const apiGetPhimTheoQuocGia = (slug, page = 1) => safeGet(`/films/quoc-gia/${slug}?page=${page}`);
export const apiGetPhimTheoNam = (slug, page = 1) => safeGet(`/films/nam-phat-hanh/${slug}?page=${page}`);
export const apiSearchPhim = (keyword, page = 1) => safeGet(`/films/search?keyword=${encodeURIComponent(keyword)}&page=${page}`);
export const apiSearchByTitle = (title) => safeGet(`/films/search?keyword=${encodeURIComponent(title)}&page=1`);

// TMDB
const TMDB_KEY = '6bae5f515f00ea9d7fb9f030d3d454ea';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const apiGetTMDBTrending = async () => {
  try {
    const res = await axios.get(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_KEY}&language=vi-VN&region=VN`);
    return res.data;
  } catch (error) { return { results: [] }; }
};

export const formatMovieItem = (item) => ({
  id: item.slug, 
  title: item.name,
  image: item.poster_url || item.thumb_url,
  year: item.year || item.time || "2024",
  quality: item.quality || "HD",
  lang: item.lang
});
