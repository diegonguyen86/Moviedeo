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

// --- GROUP SEASONS & MOVIES LOGIC (THUẬT TOÁN GỘP PHẦN VÀ MOVIE THEO NĂM PHÁT HÀNH) ---
export const apiGetRelatedSeasons = async (movieName, originalName) => {
  if (!movieName) return [];
  
  // 1. Tách tên gốc của phim (loại bỏ "Phần X", "Season X", "Mùa X", "SS X")
  const seasonRegex = /(.+?)\s*(?:[\(\[-]?\s*(?:Phần|Season|Mùa|SS|S)\s*(\d+)[\)\]-]?)/i;
  const match = movieName.match(seasonRegex);
  
  let baseName = movieName;
  if (match) {
    baseName = match[1].trim();
  } else if (originalName) {
    const origMatch = originalName.match(seasonRegex);
    baseName = origMatch ? origMatch[1].trim() : originalName.trim();
  }

  // Dọn dẹp ký tự thừa ở đuôi (dấu hai chấm, gạch nối, ngoặc)
  baseName = baseName.replace(/[:\-–—\(\)]+$/, '').trim();
  
  // 2. Tìm kiếm các phim liên quan theo baseName
  const searchRes = await apiSearchByTitle(baseName);
  const items = searchRes?.data?.items || searchRes?.items || [];
  
  if (items.length <= 1) return [];

  // Bỏ dấu tiếng Việt trước khi so (trước đây [^a-z0-9] xoá luôn chữ có dấu -> "Chức Nữ" thành "chcn")
  const normalize = (str) => String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const stripSeason = (str) => {
    const m = String(str || '').match(seasonRegex);
    return (m ? m[1] : String(str || '')).replace(/[:\-–—()]+$/, '').trim();
  };
  // Hai tên "cùng gốc": trùng nhau, hoặc tên này chứa tên kia (đủ dài để không bắt nhầm chữ ngắn như "Yêu")
  const sameBase = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = a.length < b.length ? a : b;
    return shorter.length >= 6 && (a.includes(b) || b.includes(a));
  };

  const vnBase = normalize(stripSeason(movieName));
  const origBase = normalize(stripSeason(originalName));

  // LỖI CŨ: chỉ cần trùng tên gốc tiếng Anh là bị gộp -> "Ngưu Lang Chức Nữ" (2025) và "Yêu Điên Dại" (2001)
  // cùng tên "Head Over Heels" bị gộp thành Movie 1 / Movie 2.
  // Giờ phải cùng tên tiếng Việt (bỏ "Phần X"); nếu cả hai đều có tên gốc thì tên gốc cũng không được khác hẳn nhau.
  const related = items.filter(item => {
    const itemVn = normalize(stripSeason(item.name));
    if (!sameBase(itemVn, vnBase)) return false;
    const itemOrig = normalize(stripSeason(item.origin_name || item.original_name));
    if (origBase && itemOrig && !sameBase(itemOrig, origBase)) return false;
    return true;
  });

  if (related.length <= 1) return [];

  // 3. Phân loại chuẩn: Có chữ "Phần/Season" xếp vào Seasons, Không có chữ "Phần" xếp vào Movies
  const extractNumRegex = /(?:Phần|Mùa|Season|SS)\s*(\d+)/i;
  const slugNumRegex = /(?:phan|mua|season|ss)-?(\d+)/i;

  const numberedSeasons = [];
  const movieExtras = [];

  for (const item of related) {
    let sNum = null;
    const m = (item.name && item.name.match(extractNumRegex)) ||
              (item.origin_name && item.origin_name.match(extractNumRegex)) ||
              (item.slug && item.slug.match(slugNumRegex));
    if (m) {
      sNum = parseInt(m[1]);
    }

    if (sNum !== null) {
      numberedSeasons.push({
        ...formatMovieItem(item),
        exactName: normalize(stripSeason(item.name)) === vnBase,
        seasonNumber: sNum,
        label: `Phần ${sNum}`,
        rawName: item.name
      });
    } else {
      movieExtras.push(item);
    }
  }

  // Sắp xếp các Phần theo thứ tự: Phần 1, Phần 2, Phần 3...
  // Cùng số phần thì ưu tiên bản trùng đúng tên (vd "Trò Chơi Con Mực (Phần 2)" thắng "Thử Thách Trò Chơi Con Mực (Phần 2)")
  numberedSeasons.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (b.exactName - a.exactName));

  // Khử trùng lặp: Mỗi phần chỉ lấy 1 bản chuẩn duy nhất
  const seenSeasons = new Set();
  const uniqueSeasons = [];
  for (const s of numberedSeasons) {
    if (!seenSeasons.has(s.seasonNumber)) {
      seenSeasons.add(s.seasonNumber);
      uniqueSeasons.push(s);
    }
  }

  // Sắp xếp các Movie dựa vào thời gian phát hành (Năm / Year) từ cũ đến mới (Ascending)
  const getYear = (it) => {
    const match = String(it.year || it.time || '').match(/\d{4}/);
    return match ? parseInt(match[0]) : 0;
  };
  movieExtras.sort((a, b) => getYear(a) - getYear(b));

  // Gán nhãn cho Movie: Nếu chỉ có 1 movie thì nhãn là "Movie", nếu có từ 2 movie trở lên thì là "Movie 1", "Movie 2", "Movie 3"...
  const formattedMovies = movieExtras.map((item, idx) => {
    const label = movieExtras.length === 1 ? 'Movie' : `Movie ${idx + 1}`;
    return {
      ...formatMovieItem(item),
      seasonNumber: 1000 + idx,
      label,
      rawName: item.name
    };
  });

  // Khử trùng lặp giữa các Movie (tránh trùng slug)
  const seenIds = new Set(uniqueSeasons.map(s => s.id));
  const uniqueMovies = [];
  for (const m of formattedMovies) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      uniqueMovies.push(m);
    }
  }

  // Trả về danh sách gồm các Phần phim trước, tiếp theo là các Movie sắp xếp theo năm phát hành
  return [...uniqueSeasons, ...uniqueMovies];
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
