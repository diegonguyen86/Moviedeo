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

// TMDB: gọi qua API trung gian /api/tmdb (khoá TMDB nằm ở server, không còn trong mã web)
const tmdbGet = async (path, params = {}) => {
  const qs = new URLSearchParams({ path, ...params });
  const res = await fetch(`/api/tmdb?${qs.toString()}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
};

/**
 * Logo phim (ảnh tên phim trong suốt) cho banner trang chủ.
 * movie: chi tiết phim từ PhimAPI (cần tmdb.id). Trước đây tìm theo TÊN -> dễ ra logo phim khác
 * (cùng lỗi với trailer "Xóm Nhỏ" -> "Hamlet"); giờ chỉ dùng mã TMDB có sẵn, không có thì thôi.
 */
export const apiGetMovieLogo = async (movie) => {
  const tmdb = movie?.tmdb;
  if (!tmdb?.id || (tmdb.type !== "movie" && tmdb.type !== "tv")) return null;
  const cacheKey = `logo_v2_${tmdb.type}_${tmdb.id}`;
  const cached = getCachedData(cacheKey);
  if (cached !== null && cached !== undefined) return cached || null;
  try {
    const data = await tmdbGet(`${tmdb.type}/${tmdb.id}/images`, { include_image_language: "vi,en,null" });
    const logos = data.logos || [];
    const best = logos.find((l) => l.iso_639_1 === "vi") || logos.find((l) => l.iso_639_1 === "en") || logos[0];
    const url = best ? `https://image.tmdb.org/t/p/w500${best.file_path}` : "";
    setCachedData(cacheKey, url);
    return url || null;
  } catch {
    return null;
  }
};

// =====================================================================
// TRAILER (sửa 11/2026)
// Lỗi cũ: (1) PhimAPI không có trailer -> tìm TMDB theo TÊN rồi lấy kết quả đầu tiên => hay ra
// trailer phim khác; (2) không kiểm tra video còn sống / còn cho nhúng.
// Giờ, theo thứ tự, lấy video ĐẦU TIÊN còn phát được (kiểm tra qua YouTube oEmbed):
//   1. Trailer do PhimAPI gắn sẵn (thường là bản Việt hoá / đúng phần)
//   2. TMDB theo MÃ phim có sẵn trong dữ liệu (phim bộ: ưu tiên đúng PHẦN), chỉ lấy Trailer/Teaser,
//      ưu tiên tiếng Việt > chính thức > mới nhất
//   (KHÔNG tìm theo tên: "Xóm Nhỏ" có tên gốc "Hamlet" -> trùng cả năm mà ra trailer phim Hamlet của
//    Universal. Thà báo chưa có trailer còn hơn mở nhầm phim.)
// Không tìm được -> null (nút Trailer báo "chưa có trailer"), không bao giờ mở nhầm phim khác.
// =====================================================================
const youtubeIdOf = (url) => {
  const m = String(url || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

// 200 = còn sống và cho nhúng; 401 = chủ kênh tắt nhúng; 404/400 = đã xoá / riêng tư
const isYoutubePlayable = async (key) => {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${key}`)}&format=json`);
    return res.ok;
  } catch {
    return true; // mạng chặn oEmbed thì cứ thử phát
  }
};

const pickTmdbTrailers = (videos = []) => {
  const typeRank = { Trailer: 0, Teaser: 1 };
  return videos
    .filter((v) => v.site === "YouTube" && v.key && v.type in typeRank)
    .sort((a, b) =>
      (typeRank[a.type] - typeRank[b.type]) ||
      ((b.iso_639_1 === "vi") - (a.iso_639_1 === "vi")) ||
      ((b.official ? 1 : 0) - (a.official ? 1 : 0)) ||
      (new Date(b.published_at || 0) - new Date(a.published_at || 0))
    )
    .map((v) => v.key);
};

const tmdbVideos = async (path) => {
  try {
    const data = await tmdbGet(`${path}/videos`, { include_video_language: "vi,en,null" });
    return data.results || [];
  } catch {
    return [];
  }
};

/**
 * movie: chi tiết phim từ PhimAPI (trailer_url, tmdb{id,type,season}, year, name, origin_name).
 * Trả về mã video YouTube hoặc null.
 */
export const apiGetTrailer = async (slug, title, movie = null) => {
  const cacheKey = `trailer_v3_${(slug || title || "").toLowerCase().trim()}`;
  const cached = getCachedData(cacheKey);
  if (cached !== null && cached !== undefined) return cached || null;

  let detail = movie;
  if (!detail && slug) {
    try { detail = (await apiGetPhimDetail(slug))?.movie || null; } catch { detail = null; }
  }
  void title; // giữ tham số cho tương thích, không còn tìm theo tên

  const candidates = [];
  const fromPhimApi = youtubeIdOf(detail?.trailer_url);
  if (fromPhimApi) candidates.push(fromPhimApi);

  const tmdb = detail?.tmdb;
  if (tmdb?.id && (tmdb.type === "movie" || tmdb.type === "tv")) {
    if (tmdb.type === "tv" && tmdb.season) {
      candidates.push(...pickTmdbTrailers(await tmdbVideos(`tv/${tmdb.id}/season/${tmdb.season}`)));
    }
    candidates.push(...pickTmdbTrailers(await tmdbVideos(`${tmdb.type}/${tmdb.id}`)));
  }

  const seen = new Set();
  for (const key of candidates) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 5) break; // đủ rồi, không kiểm tra quá nhiều
    if (await isYoutubePlayable(key)) {
      setCachedData(cacheKey, key);
      return key;
    }
  }
  setCachedData(cacheKey, "");
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
  const seasonRegex = /(.+?)\s*(?:[([-]?\s*(?:Phần|Season|Mùa|SS|S)\s*(\d+)[)\]-]?)/i;
  const match = movieName.match(seasonRegex);
  
  let baseName = movieName;
  if (match) {
    baseName = match[1].trim();
  } else if (originalName) {
    const origMatch = originalName.match(seasonRegex);
    baseName = origMatch ? origMatch[1].trim() : originalName.trim();
  }

  // Dọn dẹp ký tự thừa ở đuôi (dấu hai chấm, gạch nối, ngoặc)
  baseName = baseName.replace(/[:\-–—()]+$/, '').trim();
  
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
