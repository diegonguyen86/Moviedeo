import axios from "axios";

// ĐỔI SANG /phim-proxy ĐỂ TRÁNH XUNG ĐỘT VỚI VERCEL SERVERLESS FUNCTION
const baseURL = '/phim-proxy'; 
const apiClient = axios.create({ baseURL });

// --- LOGIC CACHE ---
const CACHE_TIME = 24 * 60 * 60 * 1000; 

const getCachedData = (key) => {
  const cached = localStorage.getItem("kkphim_" + key);
  if (!cached) return null;
  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > CACHE_TIME) {
    localStorage.removeItem("kkphim_" + key);
    return null;
  }
  return data;
};

const setCachedData = (key, data) => {
  localStorage.setItem("kkphim_" + key, JSON.stringify({ data, timestamp: Date.now() }));
};

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
    console.error("Lỗi gọi API:", url, error);
    return { status: false, items: [], data: { items: [] } }; 
  }
};

// --- CÁC HÀM EXPORT ---
export const apiGetPhimMoiCapNhat = (page = 1) => safeGet(`/danh-sach/phim-moi-cap-nhat?page=${page}`);
export const apiGetPhimTheoDanhSach = (slug, page = 1) => safeGet(`/v1/api/danh-sach/${slug}?page=${page}`);
export const apiGetPhimDetail = (slug) => safeGet(`/phim/${slug}`);
export const apiGetPhimTheoTheLoai = (slug, page = 1) => safeGet(`/v1/api/the-loai/${slug}?page=${page}`);
export const apiGetPhimTheoQuocGia = (slug, page = 1) => safeGet(`/v1/api/quoc-gia/${slug}?page=${page}`);
export const apiGetPhimTheoNam = (slug, page = 1) => safeGet(`/v1/api/nam/${slug}?page=${page}`);
export const apiSearchPhim = (keyword, page = 1) => safeGet(`/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`);
export const apiSearchByTitle = (title) => safeGet(`/v1/api/tim-kiem?keyword=${encodeURIComponent(title)}&page=1`);

const TMDB_KEY = '6bae5f515f00ea9d7fb9f030d3d454ea';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const apiGetTMDBTrending = async () => {
  try {
    const res = await axios.get(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_KEY}&language=vi-VN&region=VN`);
    return res.data;
  } catch (error) { return { results: [] }; }
};

const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://phimimg.com/${url}`;
};

export const formatMovieItem = (item) => ({
  id: item.slug, 
  title: item.name,
  image: getFullImageUrl(item.poster_url || item.thumb_url),
  year: item.year || item.time || "2024",
  quality: item.quality || "HD",
  lang: item.lang
});