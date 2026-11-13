// =====================================================================
// API TRUNG GIAN CHO TMDB — khoá TMDB chỉ nằm ở server (trước đây nằm lộ trong mã web, ai cũng lấy được).
// Chỉ cho phép đúng các loại truy vấn web cần (không biến thành proxy TMDB miễn phí cho người khác):
//   movie|tv/{id}/videos, movie|tv/{id}/images, tv/{id}/season/{n}/videos
// Kết quả được CDN của Vercel giữ 1 ngày -> mỗi phim chỉ hỏi TMDB khoảng 1 lần/ngày.
// Viết bằng API Node thuần (không dùng res.status/json của Vercel) để dùng chung cho máy dev (vite.config.js).
// =====================================================================
const ALLOWED = [
  /^(movie|tv)\/\d{1,9}\/(videos|images)$/,
  /^tv\/\d{1,9}\/season\/\d{1,3}\/videos$/,
];
const PASS_PARAMS = ["include_video_language", "include_image_language", "language"];

const send = (res, status, body, cache) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  const key = process.env.TMDB_KEY || process.env.VITE_TMDB_KEY;
  if (!key) return send(res, 500, { error: "TMDB chưa được cấu hình" });

  const url = new URL(req.url, "http://localhost");
  const path = String(url.searchParams.get("path") || "").replace(/^\/+/, "");
  if (!ALLOWED.some((re) => re.test(path))) return send(res, 400, { error: "Đường dẫn không được phép" });

  const target = new URL(`https://api.themoviedb.org/3/${path}`);
  target.searchParams.set("api_key", key);
  for (const p of PASS_PARAMS) {
    const v = url.searchParams.get(p);
    if (v && v.length <= 40 && /^[a-zA-Z0-9,_-]+$/.test(v)) target.searchParams.set(p, v);
  }

  try {
    const r = await fetch(target, { headers: { Accept: "application/json" } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, r.status === 404 ? 404 : 502, { error: "TMDB lỗi", status: r.status });
    // Chỉ trả phần web dùng (không trả nguyên văn mọi thứ TMDB có)
    const body = {};
    if (Array.isArray(data.results)) {
      body.results = data.results.map((v) => ({
        key: v.key, site: v.site, type: v.type, official: v.official,
        iso_639_1: v.iso_639_1, published_at: v.published_at,
      }));
    }
    if (Array.isArray(data.logos)) {
      body.logos = data.logos.map((l) => ({ file_path: l.file_path, iso_639_1: l.iso_639_1 }));
    }
    return send(res, 200, body, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch {
    return send(res, 502, { error: "Không kết nối được TMDB" });
  }
}
