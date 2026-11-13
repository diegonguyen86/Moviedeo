import admin, { ADMIN_UID, getUidFromRequest } from './_firebaseAdmin.js';

const TMDB_KEY = process.env.TMDB_KEY || process.env.VITE_TMDB_KEY;

// Chỉ cho phép: (1) Vercel Cron, (2) Admin đang đăng nhập bấm "Làm mới ngay".
// Trước đây ai cũng gọi được /api/cron-trending để ghi đè danh sách Trending.
const isAuthorized = async (req) => {
  const authHeader = req.headers?.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (!cronSecret && (req.headers?.['user-agent'] || '').includes('vercel-cron')) return true;
  const uid = await getUidFromRequest(req);
  return uid === ADMIN_UID;
};

export default async function handler(req, res) {
  // Tránh bị Vercel cache lại kết quả API
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!(await isAuthorized(req))) {
    return res.status(401).json({ success: false, message: 'Không có quyền thực hiện.' });
  }

  try {
    const db = admin.firestore();
    let allTmdbMovies = [];
    // Lấy 2 trang đầu tiên từ TMDB (40 phim) để có đủ hàng dự phòng (trừ hao KKPhim thiếu)
    for (let page = 1; page <= 2; page++) {
      const tmdbApi = `https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_KEY}&language=vi-VN&page=${page}`;
      const tmdbRes = await fetch(tmdbApi);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        if (tmdbData.results) {
          allTmdbMovies = allTmdbMovies.concat(tmdbData.results);
        }
      }
    }

    const resultMovies = [];
    const maxMovies = 15; // Lấy tối đa 15 phim thì dừng

    for (const movie of allTmdbMovies) {
      if (resultMovies.length >= maxMovies) break;

      const isTV = movie.media_type === 'tv';
      const tmdbTitle = movie.title || movie.name;
      const releaseStr = movie.release_date || movie.first_air_date;
      const tmdbYear = releaseStr ? parseInt(releaseStr.split('-')[0]) : null;

      if (!tmdbTitle || !movie.id) continue;

      const type = isTV ? 'tv' : 'movie';
      let bestMatch = null;

      try {
        const tmdbUrl = `https://phimapi.com/tmdb/${type}/${movie.id}`;
        const resKkphim = await fetch(tmdbUrl);
        if (resKkphim.ok) {
          const kkphimData = await resKkphim.json();
          if (kkphimData.status && kkphimData.movie) {
             bestMatch = kkphimData.movie;
          }
        }
      } catch (err) {
        console.log(`Lỗi fetch TMDB ID ${movie.id}:`, err.message);
      }

      // Xử lý kết quả
      if (bestMatch) {
         // Cố gắng tìm phần/season cao nhất nếu có thể
         const seasonRegex = /(.+?)\s*(?:Phần|Season|Mùa)\s*(\d+)/i;
         const match = bestMatch.name.match(seasonRegex);
         if (match || isTV) {
            const baseName = match ? match[1].trim() : bestMatch.name;
            const searchApi = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(baseName)}`;
            try {
               const searchRes = await fetch(searchApi);
               if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  const items = searchData?.data?.items || [];
                  let highestSeasonMatch = bestMatch;
                  let maxSeasonNum = match ? parseInt(match[2]) : 1;
                  
                  for (const item of items) {
                     const itemMatch = item.name.match(seasonRegex);
                     if (itemMatch) {
                        const itemSeasonNum = parseInt(itemMatch[2]);
                        if (itemSeasonNum > maxSeasonNum) {
                           highestSeasonMatch = item;
                           maxSeasonNum = itemSeasonNum;
                        }
                     }
                  }
                  bestMatch = highestSeasonMatch;
               }
            } catch(e) {}
         }

        // Tránh trùng lặp slug
        if (!resultMovies.find(m => m.slug === bestMatch.slug)) {
          resultMovies.push({
            slug: bestMatch.slug,
            name: bestMatch.name.replace(/\s*-?\s*\(?(?:Phần|Season|Mùa)\s*\d+\)?/gi, '').trim(), // Bỏ "(Phần X)" để giao diện gọn gàng nếu admin gộp các phần
            origin_name: bestMatch.origin_name,
            thumb_url: bestMatch.thumb_url,
            poster_url: bestMatch.poster_url,
            year: bestMatch.year || tmdbYear || "2024",
          });
        }
      }
    }

    // Ghi đè vào Firebase
    if (resultMovies.length > 0) {
      const docRef = db.collection("admin_settings").doc("top_trending");
      await docRef.set({ movies: resultMovies });
      return res.status(200).json({ 
        success: true, 
        message: `Đã cập nhật ${resultMovies.length} phim trending mới nhất!`,
        count: resultMovies.length, 
        movies: resultMovies 
      });
    } else {
      return res.status(404).json({ success: false, message: "Không tìm thấy phim nào khớp với PhimAPI." });
    }

  } catch (error) {
    console.error("Lỗi Cron Job:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
