// Bộ icon riêng cho trình phát: SVG nét 2px, đầu bo tròn, cùng một khung 24x24 để mọi nút cân nhau.
// (Font icon Material vẽ "replay_10" / "forward_10" nét mảnh, số 10 nhoè ở cỡ nhỏ -> trông rẻ.)

const base = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const PlayIcon = (p) => (
  <svg {...base} {...p} stroke="none" fill="currentColor">
    <path d="M7.5 4.6v14.8c0 1.1 1.2 1.8 2.2 1.2l12-7.4c.9-.6.9-1.9 0-2.4l-12-7.4c-1-.6-2.2.1-2.2 1.2z" />
  </svg>
);

export const PauseIcon = (p) => (
  <svg {...base} {...p} stroke="none" fill="currentColor">
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.4" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.4" />
  </svg>
);

// Vòng mũi tên + số 10 (lùi)
export const Back10Icon = (p) => (
  <svg {...base} {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3.5 3.5V8H8" />
    <text x="12.2" y="15.6" textAnchor="middle" fontSize="8.2" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, sans-serif">10</text>
  </svg>
);

// Vòng mũi tên + số 10 (tới)
export const Fwd10Icon = (p) => (
  <svg {...base} {...p}>
    <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
    <path d="M20.5 3.5V8H16" />
    <text x="11.8" y="15.6" textAnchor="middle" fontSize="8.2" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, sans-serif">10</text>
  </svg>
);

export const VolumeIcon = ({ level = 1, muted = false, ...p }) => (
  <svg {...base} {...p}>
    <path d="M11 5 6.5 9H3.5v6h3L11 19z" fill="currentColor" />
    {muted ? (
      <>
        <path d="m16 9.5 5 5" />
        <path d="m21 9.5-5 5" />
      </>
    ) : (
      <>
        <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        {level > 0.5 && <path d="M18.4 6.4a8 8 0 0 1 0 11.2" />}
      </>
    )}
  </svg>
);

export const EpisodesIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="14" height="14" rx="2.5" />
    <path d="M21 8v10.5a2.5 2.5 0 0 1-2.5 2.5H8" />
    <path d="m8.5 9.5 4 2.5-4 2.5z" fill="currentColor" />
  </svg>
);

export const SpeedIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 18.5a9 9 0 1 1 15 0" />
    <path d="m12 13.5 4-4.5" />
    <circle cx="12" cy="13.5" r="1.2" fill="currentColor" />
  </svg>
);

export const SubtitlesIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M7 12.5h4M14 12.5h3M7 15.5h2.5M12.5 15.5H17" />
  </svg>
);

export const FullscreenIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
    <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
    <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
    <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </svg>
);

export const ExitFullscreenIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4" />
    <path d="M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4" />
    <path d="M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20" />
    <path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
  </svg>
);

export const NextIcon = (p) => (
  <svg {...base} {...p} stroke="none" fill="currentColor">
    <path d="M5 5.6v12.8c0 1 1.1 1.6 2 1.1l9.6-6.4c.8-.5.8-1.7 0-2.2L7 4.5c-.9-.5-2 .1-2 1.1z" />
    <rect x="17.5" y="4.5" width="2.5" height="15" rx="1.2" />
  </svg>
);
