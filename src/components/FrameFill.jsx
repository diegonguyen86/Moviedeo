import { useEffect, useRef } from "react";

// =====================================================================
// LẤP SỌC ĐEN DO KHUNG HÌNH BẰNG ÁNH SÁNG MỜ (nằm TRONG khung phát, ngay sau thẻ <video>)
// Phim khác tỉ lệ khung (16:9 trong trang / tỉ lệ màn khi toàn màn hình) có vùng trống trên/dưới
// hoặc hai bên -> thấy màu của chính cảnh phim loang ra thay vì đen. Chạy cả khi toàn màn hình.
// Sọc chèn sẵn TRONG file video thì không đụng tới.
//
// Rẻ: canvas 32x18, ~6 lần/giây, chỉ khi đang phát; khung trùng tỉ lệ phim thì không vẽ phần tử luôn.
// =====================================================================

const W = 32;
const H = 18;
const FRAME_MS = 160;

export default function FrameFill({ videoRef, active, isPlaying }) {
  const canvasRef = useRef(null);
  const lastRef = useRef(0);

  const draw = (alpha) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
    try {
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.globalAlpha = alpha;
      ctx.drawImage(video, 0, 0, W, H);
      ctx.globalAlpha = 1;
    } catch {
      /* chưa có khung hình */
    }
  };

  useEffect(() => {
    if (!active || !isPlaying) return;
    const video = videoRef.current;
    if (!video) return;
    let raf = 0;
    let vfc = 0;
    let stopped = false;
    const tick = (now) => {
      if (stopped) return;
      if (!document.hidden && now - lastRef.current >= FRAME_MS) {
        lastRef.current = now;
        draw(0.4);
      }
      schedule();
    };
    const schedule = () => {
      if (typeof video.requestVideoFrameCallback === "function") vfc = video.requestVideoFrameCallback((now) => tick(now));
      else raf = requestAnimationFrame(tick);
    };
    schedule();
    return () => {
      stopped = true;
      if (vfc && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(vfc);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isPlaying, videoRef]);

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

  // Không bật thì không vẽ phần tử luôn (đỡ 1 lớp đồ hoạ)
  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      aria-hidden="true"
      // Tràn 15% ra ngoài mỗi phía để mép ảnh mờ không lộ ra đúng chỗ sọc
      className="pointer-events-none absolute -inset-[15%] h-[130%] w-[130%] blur-[28px] saturate-[1.5] brightness-[0.85]"
    />
  );
}
