import admin from 'firebase-admin';

// Khởi tạo quyền Admin Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();
const TMDB_KEY = process.env.TMDB_KEY;
const KKPHIM_SEARCH_API = 'https://phimapi.com/v1/api/tim-kiem?keyword=';

export default async function handler(req, res) {
  // Tránh bị Vercel cache lại kết quả API
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
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
      const originalTitle = movie.original_title || movie.original_name;
      const tmdbOriginLower = (originalTitle || "").toLowerCase();
      const releaseStr = movie.release_date || movie.first_air_date;
      const tmdbYear = releaseStr ? parseInt(releaseStr.split('-')[0]) : null;

      if (!tmdbTitle) continue;

      let kkphimResults = [];
      try {
        const searchUrlVi = `${KKPHIM_SEARCH_API}${encodeURIComponent(tmdbTitle)}`;
        const resVi = await fetch(searchUrlVi);
        if (resVi.ok) {
          const dataVi = await resVi.json();
          if (dataVi?.data?.items) kkphimResults = dataVi.data.items;
        }
      } catch (err) {
        console.log('Lỗi fetch tên Việt:', err.message);
      }

      if (kkphimResults.length === 0 && originalTitle && originalTitle !== tmdbTitle) {
        try {
          const searchUrlEng = `${KKPHIM_SEARCH_API}${encodeURIComponent(originalTitle)}`;
          const resEng = await fetch(searchUrlEng);
          if (resEng.ok) {
            const dataEng = await resEng.json();
            if (dataEng?.data?.items) kkphimResults = dataEng.data.items;
          }
        } catch (err) {
          console.log('Lỗi fetch tên gốc:', err.message);
        }
      }

      let bestMatch = null;

      // CƠ CHẾ ĐỐI CHIẾU
      if (isTV) {
        let tvSeasons = kkphimResults.filter(item => {
          const kkOrigin = (item.origin_name || "").toLowerCase();
          return tmdbOriginLower && kkOrigin.includes(tmdbOriginLower);
        });
        if (tvSeasons.length > 0) {
          tvSeasons.sort((a, b) => parseInt(b.year) - parseInt(a.year));
          bestMatch = tvSeasons[0];
        }
      } else {
        for (const item of kkphimResults) {
          if (parseInt(item.year) === tmdbYear) {
            bestMatch = item;
            break;
          }
        }
      }

      // Xử lý kết quả
      if (bestMatch) {
        // Tránh trùng lặp slug
        if (!resultMovies.find(m => m.slug === bestMatch.slug)) {
          resultMovies.push({
            slug: bestMatch.slug,
            name: bestMatch.name,
            origin_name: bestMatch.origin_name,
            thumb_url: bestMatch.thumb_url,
            poster_url: bestMatch.poster_url,
            year: bestMatch.year,
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
