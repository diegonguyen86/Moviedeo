import axios from "axios";

// Ưu tiên gọi trực tiếp https://phimapi.com để tránh độ trễ qua Vercel Serverless proxy (tiết kiệm 300-800ms)
// PhimAPI đã bật sẵn CORS (Access-Control-Allow-Origin: *)
const PRIMARY_BASE_URL = 'https://phimapi.com';
const FALLBACK_BASE_URL = '/phim-proxy';

const apiClient = axios.create({ 
  baseURL: PRIMARY_BASE_URL,
  timeout: 8000 // 8s timeout tránh treo request
});

// --- BỘ NHỚ ĐỆM KÉP: RAM (Memory Cache 0ms) + LocalStorage (Persistent) ---
const CACHE_TIME = 24 * 60 * 60 * 1000; // 24 giờ
const STALE_TIME = 10 * 60 * 1000;      // 10 phút (SWR: sau 10p sẽ âm thầm tải mới ở background)

const memoryCache = new Map();

export const getCachedData = (key) => {
  // 1. Kiểm tra RAM trước (Tốc độ 0ms, không tốn CPU parse JSON)
  if (memoryCache.has(key)) {
    const mem = memoryCache.get(key);
    if (Date.now() - mem.timestamp < CACHE_TIME) {
      return mem.data;
    }
    memoryCache.delete(key);
  }

  // 2. Kiểm tra LocalStorage
  try {
    const cached = localStorage.getItem("kkphim_" + key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TIME) {
      localStorage.removeItem("kkphim_" + key);
      return null;
    }
    // Đưa ngược vào RAM để lần sau gọi có ngay trong 0ms
    memoryCache.set(key, { data, timestamp });
    return data;
  } catch (e) {
    return null;
  }
};

export const setCachedData = (key, data) => {
  const timestamp = Date.now();
  memoryCache.set(key, { data, timestamp });
  try {
    localStorage.setItem("kkphim_" + key, JSON.stringify({ data, timestamp }));
  } catch (error) {
    // Nếu LocalStorage đầy, dọn bớt các cache cũ
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("kkphim_")) {
          localStorage.removeItem(k);
          break;
        }
      }
    } catch (_) {}
  }
};

// CƠ CHẾ SWR (Stale-While-Revalidate):
// - Nếu đã có cache: Trả về NGAY LẬP TỨC trong 0ms cho UI hiển thị
// - Nếu cache đã cũ (> 10 phút): Tự động fetch ngầm ở background để cập nhật cache mới nhất
export const safeGet = async (url) => {
  const cached = getCachedData(url);
  const mem = memoryCache.get(url);
  const isStale = !mem || (Date.now() - mem.timestamp > STALE_TIME);

  if (cached) {
    // Nếu cache đã hơi cũ (> 10 phút), âm thầm tải mới ở background
    if (isStale) {
      fetchAndCache(url).catch(() => {});
    }
    return cached;
  }

  // Chưa có cache -> Phải chờ lấy dữ liệu lần đầu
  return await fetchAndCache(url);
};

const fetchAndCache = async (url) => {
  try {
    // Thử gọi trực tiếp phimapi.com
    const res = await apiClient.get(url);
    if (res.data) {
      setCachedData(url, res.data);
      return res.data;
    }
  } catch (error) {
    // Nếu lỗi mạng, thử fallback qua proxy /phim-proxy
    try {
      const fallbackRes = await axios.get(`${FALLBACK_BASE_URL}${url}`, { timeout: 8000 });
      if (fallbackRes.data) {
        setCachedData(url, fallbackRes.data);
        return fallbackRes.data;
      }
    } catch (fallbackError) {
      console.warn("Lỗi gọi API (cả trực tiếp và proxy):", url);
    }
  }
  return { status: false, items: [], data: { items: [] } };
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

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const apiGetTMDBTrending = async () => {
  const cacheKey = "tmdb_trending_day";
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_KEY}&language=vi-VN&region=VN`);
    if (res.data) {
      setCachedData(cacheKey, res.data);
    }
    return res.data;
  } catch (error) { 
    return { results: [] }; 
  }
};

export const apiGetMovieLogo = async (title) => {
  if (!title) return null;
  const cacheKey = `logo_${title.toLowerCase().trim()}`;
  const cached = getCachedData(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  try {
    const searchRes = await axios.get(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=vi-VN`, { timeout: 4000 });
    const tmdbId = searchRes.data.results?.[0]?.id;
    const mediaType = searchRes.data.results?.[0]?.media_type || 'movie';
    if (!tmdbId) {
      setCachedData(cacheKey, "");
      return null;
    }
    
    const imageRes = await axios.get(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}/images?api_key=${TMDB_KEY}`, { timeout: 4000 });
    const logos = imageRes.data.logos;
    if (!logos || logos.length === 0) {
      setCachedData(cacheKey, "");
      return null;
    }
    
    const bestLogo = logos.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'vi') || logos[0];
    const logoUrl = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
    setCachedData(cacheKey, logoUrl);
    return logoUrl;
  } catch (error) {
    return null;
  }
};

export const apiGetTrailer = async (slug, title) => {
  const cacheKey = `trailer_${(slug || title || "").toLowerCase().trim()}`;
  const cached = getCachedData(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  // 1. Thử lấy trailer chính chủ từ PhimAPI trước (đảm bảo sống 100%)
  if (slug) {
    try {
      const res = await apiGetPhimDetail(slug);
      const trailerUrl = res?.movie?.trailer_url;
      if (trailerUrl && trailerUrl.includes('youtube.com/watch?v=')) {
        const key = trailerUrl.split('v=')[1].split('&')[0];
        setCachedData(cacheKey, key);
        return key;
      } else if (trailerUrl && trailerUrl.includes('youtu.be/')) {
        const key = trailerUrl.split('youtu.be/')[1].split('?')[0];
        setCachedData(cacheKey, key);
        return key;
      }
    } catch (error) {}
  }

  // 2. Nếu PhimAPI không có, quét bằng TMDB
  if (title) {
    try {
      const searchRes = await axios.get(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=vi-VN`, { timeout: 4000 });
      const tmdbId = searchRes.data.results?.[0]?.id;
      const mediaType = searchRes.data.results?.[0]?.media_type || 'movie';
      if (!tmdbId) {
        setCachedData(cacheKey, "");
        return null;
      }
      
      const videoRes = await axios.get(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}/videos?api_key=${TMDB_KEY}`, { timeout: 4000 });
      const videos = videoRes.data.results;
      if (!videos || videos.length === 0) {
        setCachedData(cacheKey, "");
        return null;
      }
      
      const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
      const key = trailer ? trailer.key : null;
      setCachedData(cacheKey, key || "");
      return key;
    } catch (error) {}
  }
  
  return null;
};

const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://phimimg.com/${url}`;
};

export const formatMovieItem = (item) => ({
  id: item.slug || item.id, 
  title: item.name || item.title || "",
  name: item.name || item.title || "",
  origin_name: item.origin_name || item.original_name || item.original_title || "",
  image: getFullImageUrl(item.poster_url || item.thumb_url),
  thumb_url: getFullImageUrl(item.thumb_url || item.poster_url),
  year: item.year || item.time || "2024",
  quality: item.quality || "HD",
  lang: item.lang || "Vietsub",
  description: item.content?.replace(/<[^>]*>?/gm, '') || item.description || ""
});

// --- GROUP SEASONS LOGIC ---
export const apiGetRelatedSeasons = async (movieName, originalName) => {
  if (!movieName) return [];
  
  const seasonRegex = /(.+?)\s*(?:Phần|Season|Mùa)\s*(\d+)/i;
  const match = movieName.match(seasonRegex);
  
  let baseName = movieName;
  if (match) {
    baseName = match[1].trim();
  } else if (originalName) {
    baseName = originalName;
  }
  
  const searchRes = await apiSearchByTitle(baseName);
  const items = searchRes?.data?.items || searchRes?.items || [];
  
  if (items.length <= 1) return [];

  const normalize = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedBase = normalize(baseName);
  
  const related = items.filter(item => {
    const nName = normalize(item.name);
    const nOrig = normalize(item.origin_name || item.original_name || '');
    return nName.includes(normalizedBase) || nOrig.includes(normalizedBase);
  });

  if (related.length <= 1) return [];

  const seasons = related.map(item => {
    const m = item.name.match(seasonRegex);
    const seasonNumber = m ? parseInt(m[2]) : 1; 
    return {
      ...formatMovieItem(item),
      seasonNumber,
      rawName: item.name
    };
  });

  seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

  const uniqueSeasons = [];
  const seenSeasons = new Set();
  for (const s of seasons) {
    if (!seenSeasons.has(s.seasonNumber)) {
      seenSeasons.add(s.seasonNumber);
      uniqueSeasons.push(s);
    }
  }

  return uniqueSeasons;
};

export const deduplicateSeasons = (movies) => {
  if (!movies || movies.length === 0) return [];
  
  const seasonRegex = /(.+?)\s*(?:Phần|Season|Mùa)\s*(\d+)/i;
  const groups = {};
  
  for (const movie of movies) {
    const rawName = movie.title || movie.name || "";
    const match = rawName.match(seasonRegex);
    
    let baseName = rawName;
    let seasonNum = 1;
    
    if (match) {
      baseName = match[1].trim();
      seasonNum = parseInt(match[2]);
    }
    
    const normalizedBase = String(baseName).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalizedBase) continue;
    
    if (!groups[normalizedBase]) {
      groups[normalizedBase] = { bestMovie: movie, maxSeason: seasonNum };
    } else {
      if (seasonNum > groups[normalizedBase].maxSeason) {
        groups[normalizedBase] = { bestMovie: movie, maxSeason: seasonNum };
      }
    }
  }
  
  const bestMoviesSet = new Set(Object.values(groups).map(g => g.bestMovie.id));
  return movies.filter(m => bestMoviesSet.has(m.id));
};
