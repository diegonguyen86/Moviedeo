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
  try {
    localStorage.setItem("kkphim_" + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (error) {
    console.warn("Lỗi lưu cache (có thể do quá dung lượng):", error);
  }
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

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const apiGetTMDBTrending = async () => {
  try {
    const res = await axios.get(`${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_KEY}&language=vi-VN&region=VN`);
    return res.data;
  } catch (error) { return { results: [] }; }
};

export const apiGetTrailer = async (title) => {
  try {
    const searchRes = await axios.get(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=vi-VN`);
    const tmdbId = searchRes.data.results?.[0]?.id;
    const mediaType = searchRes.data.results?.[0]?.media_type || 'movie';
    if (!tmdbId) return null;
    
    const videoRes = await axios.get(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}/videos?api_key=${TMDB_KEY}`);
    const videos = videoRes.data.results;
    if (!videos || videos.length === 0) return null;
    
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
    return trailer ? trailer.key : null;
  } catch (error) {
    return null;
  }
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
        groups[normalizedBase].bestMovie = movie;
        groups[normalizedBase].maxSeason = seasonNum;
      }
    }
  }
  
  const bestMoviesSet = new Set(Object.values(groups).map(g => g.bestMovie.id));
  return movies.filter(m => bestMoviesSet.has(m.id));
};