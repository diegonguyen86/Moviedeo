import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const ANDROID_ICON = (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341a.999.999 0 1 1 0-1.998.999.999 0 0 1 0 1.998m-11.046 0a.999.999 0 1 1 0-1.998.999.999 0 0 1 0 1.998m11.405-6.02 1.997-3.459a.416.416 0 0 0-.152-.568.416.416 0 0 0-.568.152l-2.022 3.503A12.4 12.4 0 0 0 12 7.855c-1.853 0-3.59.389-5.137 1.095L4.841 5.447a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.568l1.997 3.459C2.689 11.187.343 14.659 0 18.761h24c-.343-4.102-2.689-7.574-6.118-9.44z"/></svg>
);
const APPLE_ICON = (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M16.365 21.439c-1.424.966-2.584.872-3.877.01-1.282-.857-2.673-.896-4.043.013-1.884 1.258-3.323.518-4.498-1.25-2.73-4.12-3.66-9.134-1.636-12.72 1.134-2.003 2.946-3.136 4.963-3.174 1.706-.033 3.238.995 4.148 1.054.912.06 2.687-1.127 4.707-1.026 1.834.053 3.407.785 4.394 2.115-3.626 2.05-3.084 6.814.395 8.192-1.035 2.502-2.316 4.887-4.553 6.786zm-2.825-18.423c-.782 1.028-2.062 1.637-3.342 1.503-.232-1.393.425-2.756 1.233-3.699.82-.988 2.146-1.632 3.37-1.488.225 1.346-.43 2.683-1.261 3.684z"/></svg>
);

const PLATFORMS = [
  { key: "android", name: "Điện thoại Android", note: "Tệp APK", icon: ANDROID_ICON },
  { key: "ios", name: "iPhone / iPad", note: "Tệp IPA, cài bằng sideload", icon: APPLE_ICON },
  { key: "tv", name: "Smart TV Android", note: "Tệp APK cho TV", icon: <span className="material-symbols-outlined text-[20px]">tv</span> },
];

export default function AppDownloadModal({ isOpen, onClose }) {
  const [releases, setReleases] = useState(null); // null = đang tải
  const [failed, setFailed] = useState(false);
  // Header truyền onClose dạng hàm mới mỗi lần vẽ -> giữ trong ref để không gọi API lại liên tục
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);

    let isCurrent = true;
    setFailed(false);
    fetch("/api/releases")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
      .then((data) => { if (isCurrent) setReleases(data); })
      .catch(() => { if (isCurrent) { setFailed(true); setReleases({}); } });

    return () => {
      isCurrent = false;
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
        className="animate-fade-in w-full max-w-md rounded-2xl border border-line bg-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" className="size-12 rounded-xl object-contain" />
          <div className="min-w-0 flex-1">
            <h2 id="download-title" className="text-lg font-semibold text-fg">Tải app Phim Hay Quá Trời</h2>
            <p className="mt-0.5 text-sm text-fg-2">Xem mượt hơn trên điện thoại và TV.</p>
          </div>
          <button onClick={onClose} className="-mr-2 -mt-2 flex size-9 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-white/5 hover:text-fg" aria-label="Đóng">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
          {PLATFORMS.map((p) => {
            const info = releases?.[p.key];
            const url = info?.url;
            return (
              <li key={p.key} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-fg">{p.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{p.name}</p>
                  {releases === null ? (
                    <div className="skeleton mt-1.5 h-3 w-24 rounded-full" />
                  ) : (
                    <p className="text-xs text-fg-3">{url ? `${p.note}${info.version ? ` · v${info.version}` : ""}` : "Chưa có bản phát hành"}</p>
                  )}
                </div>
                {url ? (
                  <a
                    href={url}
                    target={p.key === "ios" ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="btn-primary flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Tải
                  </a>
                ) : (
                  releases !== null && <span className="shrink-0 text-xs text-fg-3">Sắp có</span>
                )}
              </li>
            );
          })}
        </ul>

        {failed && <p className="mt-3 text-sm text-red-400">Chưa lấy được link tải. Thử lại sau ít phút.</p>}
      </div>
    </div>,
    document.body
  );
}
