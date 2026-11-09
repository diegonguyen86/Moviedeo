// =====================================================================
// PHÁT HIỆN QUẢNG CÁO CHÈN TRONG FILE M3U8 (dùng chung cách với app TV)
//
// Trước đây web soi màu đỏ trên khung hình quanh phút 15 rồi tua cố định 31,5s.
// Giờ đọc thẳng danh sách đoạn phim (m3u8): nguồn phim chèn quảng cáo thành một khối
// riêng, kẹp giữa hai thẻ #EXT-X-DISCONTINUITY, đường dẫn đoạn khác hẳn phần phim.
// -> biết chính xác quảng cáo bắt đầu/kết thúc ở giây nào của TỪNG TẬP (không có mốc cứng).
// Đo thực tế 11/2026: thường ở giây ~900-903, dài ~30,2s, 11 đoạn "/v8/<hash>/segment_xxxx.ts".
//
// Cố ý KHÔNG coi là quảng cáo: các đoạn lẻ "convertv8/xxx.ts" quanh phút 3 (cũng có
// DISCONTINUITY nhưng là nội dung phim thật).
// =====================================================================

const MIN_AD_SECONDS = 10;
const MAX_AD_SECONDS = 90;
const MIN_AD_SEGMENTS = 3;

const cache = new Map(); // url -> Promise<breaks>

const resolveUrl = (base, rel) => {
  try { return new URL(rel, base).toString(); } catch { return rel; }
};

// Thư mục của một đường dẫn đoạn: "abc.ts" -> "", "convertv8/x.ts" -> "convertv8", "/v8/hash/s.ts" -> "/v8/hash"
const dirOf = (uri) => {
  const clean = uri.split('?')[0];
  const i = clean.lastIndexOf('/');
  return i === -1 ? '' : clean.slice(0, i);
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Tách playlist thành các khối giữa #EXT-X-DISCONTINUITY. */
export function parseBlocks(text) {
  const blocks = [];
  let t = 0;
  let pending = 0;
  let cur = { start: 0, duration: 0, segments: 0, dirs: new Set() };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line === '#EXT-X-DISCONTINUITY') {
      blocks.push(cur);
      cur = { start: t, duration: 0, segments: 0, dirs: new Set() };
    } else if (line.startsWith('#EXTINF:')) {
      pending = parseFloat(line.slice(8)) || 0;
    } else if (!line.startsWith('#')) {
      cur.duration += pending;
      cur.segments += 1;
      cur.dirs.add(dirOf(line));
      t += pending;
      pending = 0;
    }
  }
  blocks.push(cur);
  return { blocks: blocks.filter(b => b.segments > 0), total: t };
}

/** Chọn ra các khối là quảng cáo: [{ start, end }] tính bằng giây. */
export function pickAdBreaks({ blocks, total }) {
  if (blocks.length < 2) return [];

  // Thư mục "chính" = thư mục của phần lớn thời lượng phim
  const weight = new Map();
  for (const b of blocks) {
    for (const d of b.dirs) weight.set(d, (weight.get(d) || 0) + b.duration);
  }
  const mainDir = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return blocks
    .filter(b =>
      b.duration >= MIN_AD_SECONDS &&
      b.duration <= MAX_AD_SECONDS &&
      b.segments >= MIN_AD_SEGMENTS &&
      b.duration < total * 0.2 &&
      !b.dirs.has(mainDir)
    )
    .map(b => ({ start: b.start, end: b.start + b.duration }));
}

/** Đọc m3u8 (kể cả master playlist) và trả về danh sách quảng cáo. Lỗi -> []. */
export function findAdBreaks(rawUrl) {
  if (!rawUrl || !/\.m3u8(\?|$)/i.test(rawUrl)) return Promise.resolve([]);
  const url = rawUrl.replace('http://', 'https://');
  if (cache.has(url)) return cache.get(url);

  const job = (async () => {
    try {
      let text = await fetchText(url);
      if (text.includes('#EXT-X-STREAM-INF')) {
        const variant = text.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
        if (!variant) return [];
        text = await fetchText(resolveUrl(url, variant));
      }
      return pickAdBreaks(parseBlocks(text));
    } catch {
      cache.delete(url); // lỗi mạng -> lần sau thử lại
      return [];
    }
  })();

  cache.set(url, job);
  return job;
}
