import { useEffect, useRef } from "react";

// =====================================================================
// ÁNH SÁNG NỀN (AMBIENT) KIỂU YOUTUBE — bản "rực rỡ"
// Vẽ khung hình đang phát lên canvas rất nhỏ rồi phóng to + làm mờ + đẩy màu bằng CSS
// -> quầng sáng quanh khung video đổi màu theo cảnh phim. Chỉ chạy khi KHÔNG toàn màn hình.
//
// 2 lớp sáng:
//   - Lớp trong: ôm sát khung, đậm, màu cháy (saturate cao) -> viền sáng rực quanh video
//   - Lớp ngoài: loang rộng, mờ nhiều, "thở" chậm (phồng/xẹp nhẹ) -> cả trang như có đèn hắt
//
// - Rẻ: canvas 64x36, ~8 lần/giây, chỉ khi video đang phát và tab đang hiển thị.
//   Lớp ngoài chép lại từ lớp trong (không đọc video 2 lần).
//   Đo 11/2026 (Loki 1080p, màn 144Hz): bật hay tắt đều 144 khung/giây, 0 khung video rớt, RAM như nhau.
//   Đã thử làm mờ ngay trên canvas (ctx.filter) để bỏ CSS blur -> ánh sáng bị vỡ ô, lộ viền chữ nhật: bỏ.
// - Mượt: khung mới chồng lên khung cũ với độ trong 30% -> màu chuyển dần, không giật.
// - Không cần CORS: chỉ VẼ video lên canvas để hiển thị (không đọc điểm ảnh).
// =====================================================================

const W = 64;
const H = 36;
const FRAME_MS = 120;
const BLEND = 0.3;

export default function AmbientGlow({ videoRef, active, isPlaying }) {
  const innerRef = useRef(null);
  const outerRef = useRef(null);
  const lastDrawRef = useRef(0);

  const draw = (alpha) => {
    const video = videoRef.current;
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!video || !inner || video.readyState < 2) return;
    try {
      const ctx = inner.getContext("2d", { alpha: false });
      ctx.globalAlpha = alpha;
      ctx.drawImage(video, 0, 0, W, H);
      ctx.globalAlpha = 1;
      if (outer) outer.getContext("2d", { alpha: false }).drawImage(inner, 0, 0);
    } catch {
      /* video chưa có khung hình */
    }
  };

  // Vòng lặp khi đang phát
  useEffect(() => {
    if (!active || !isPlaying) return;
    const video = videoRef.current;
    if (!video) return;
    let rafId = 0;
    let vfcId = 0;
    let stopped = false;

    const tick = (now) => {
      if (stopped) return;
      if (!document.hidden && now - lastDrawRef.current >= FRAME_MS) {
        lastDrawRef.current = now;
        draw(BLEND);
      }
      schedule();
    };
    // requestVideoFrameCallback chỉ gọi khi có khung hình mới (tiết kiệm hơn rAF)
    const schedule = () => {
      if (typeof video.requestVideoFrameCallback === "function") {
        vfcId = video.requestVideoFrameCallback((now) => tick(now));
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };
    schedule();

    return () => {
      stopped = true;
      if (vfcId && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(vfcId);
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isPlaying, videoRef]);

  // Tạm dừng / tua / đổi tập / vừa bật lại: vẽ ngay khung hiện tại để nền khớp hình đang đứng
  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    const snap = () => draw(1);
    snap();
    video.addEventListener("seeked", snap);
    video.addEventListener("loadeddata", snap);
    return () => {
      video.removeEventListener("seeked", snap);
      video.removeEventListener("loadeddata", snap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, videoRef]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-1000 ${active ? "opacity-100" : "opacity-0"}`}
    >
      {/* Lớp ngoài: loang rộng khắp trang, "thở" chậm */}
      <div className="absolute -inset-x-[18%] -inset-y-[30%] animate-ambient-breathe">
        <canvas
          ref={outerRef}
          width={W}
          height={H}
          className="h-full w-full opacity-70 blur-[110px] saturate-[2.4] brightness-125 md:blur-[150px]"
        />
      </div>
      {/* Lớp trong: ôm sát khung, đậm và cháy màu */}
      <div className="absolute -inset-x-[5%] -inset-y-[9%]">
        <canvas
          ref={innerRef}
          width={W}
          height={H}
          className="h-full w-full opacity-95 blur-[40px] saturate-[2.2] contrast-125 brightness-110 md:blur-[55px]"
        />
      </div>
    </div>
  );
}
