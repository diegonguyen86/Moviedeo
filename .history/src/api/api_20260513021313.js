import axios from "axios";

// ĐÃ CHUYỂN NHÀ SANG KKPHIM (PhimAPI)
const baseURL = '/api'; 
const apiClient = axios.create({ baseURL });

// --- LOGIC CACHE (Lưu 1 ngày để web mượt, giữ nguyên khi tắt trình duyệt) ---
const CACHE_TIME = 24 * 60 * 60 * 1000; 
const getCachedData = (key) => {
  // SỬA Ở ĐÂY: Đổi "cache_" thành "kkphim_" để ép xóa cache rác của API cũ
  const cached = localStorage.getItem("kkphim_" + key);
  if (!cached) return null;
  
  const { data, timestamp } = JSON.parse(cached);
  
  if (Date.now() - timestamp > CACHE_TIME) {
    localStorage.removeItem("kkphim_" + key); // SỬA Ở ĐÂY
    return null;
  }
  return data;
};
const setCachedData = (key, data) => {
  // SỬA Ở ĐÂY
  localStorage.setItem("kkphim_" + key, JSON.stringify({ data, timestamp: Date.now() }));
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
    return { status: "success", items: [], data: { items: [] } }; 
  }
};

// --- CÁC HÀM EXPORT (Đã ánh xạ theo chuẩn KKPhim/PhimAPI) ---
export const apiGetPhimMoiCapNhat = (page = 1) => safeGet(`/danh-sach/phim-moi-cap-nhat?page=${page}`);
export const apiGetPhimTheoDanhSach = (slug, page = 1) => safeGet(`/v1/api/danh-sach/${slug}?page=${page}`);
export const apiGetPhimDetail = (slug) => safeGet(`/phim/${slug}`);
export const apiGetPhimTheoTheLoai = (slug, page = 1) => safeGet(`/v1/api/the-loai/${slug}?page=${page}`);
export const apiGetPhimTheoQuocGia = (slug, page = 1) => safeGet(`/v1/api/quoc-gia/${slug}?page=${page}`);
export const apiGetPhimTheoNam = (slug, page = 1) => safeGet(`/v1/api/nam/${slug}?page=${page}`);
export const apiSearchPhim = (keyword, page = 1) => safeGet(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`);
export const apiSearchByTitle = (title) => safeGet(`/v1/api/tim-kiem?keyword=${encodeURIComponent(title)}&page=1`);

// TMDB (Giữ nguyên)
const TMDB_KEY = '6bae5f515f00ea9d7fb9f030d3d454ea';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const apiGetTMDBTrending = async () => {
  try {
    const res = await axios.get(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_KEY}&language=vi-VN&region=VN`);
    return res.data;
  } catch (error) { return { results: [] }; }
};

// Xử lý thông minh link ảnh (KKPhim hay trả về link thiếu domain đầu)
const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://phimimg.com/${url}`; // Thêm CDN chuẩn của hệ thống
};

export const formatMovieItem = (item) => ({
  id: item.slug, 
  title: item.name,
  image: getFullImageUrl(item.poster_url || item.thumb_url),
  year: item.year || item.time || "2024",
  quality: item.quality || "HD",
  lang: item.lang
});