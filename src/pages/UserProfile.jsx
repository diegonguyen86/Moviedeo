import { useState, useEffect } from "react";
import { useAuth, RANK_STEPS } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  doc,
  getDocs,
  getDoc,
  setDoc
} from "firebase/firestore";
import MovieCard from "../components/MovieCard";
import { useWatchlist } from "../hooks/useWatchlist";
import { Link } from "react-router-dom";

export default function UserProfile() {
  const { user, logout, getRankInfo } = useAuth();
  const [stats, setStats] = useState({ watchedCount: 0, totalWatchSeconds: 0 });
  const [loading, setLoading] = useState(true);
  const { watchlist } = useWatchlist();

  useEffect(() => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      
      const checkAndInitStats = async () => {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        
        let updates = {};
        let needUpdate = false;

        if (data.watchedCount === undefined) {
          const historySnap = await getDocs(collection(db, "users", user.uid, "watchHistory"));
          updates.watchedCount = historySnap.size;
          needUpdate = true;
        }

        if (data.totalWatchSeconds === undefined) {
          const count = updates.watchedCount !== undefined ? updates.watchedCount : (data.watchedCount || 0);
          updates.totalWatchSeconds = count * 5400; // Giả lập 1 phim = 1.5 giờ = 5400 giây
          needUpdate = true;
        }

        if (needUpdate) {
          await setDoc(userRef, updates, { merge: true });
        }
      };
      checkAndInitStats().catch((err) => console.warn("Không khởi tạo được thống kê:", err));

      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setStats({
            watchedCount: docSnap.data().watchedCount || 0,
            totalWatchSeconds: docSnap.data().totalWatchSeconds || 0
          });
        }
        setLoading(false);
      }, () => setLoading(false)); // Lỗi mạng / quyền: vẫn tắt loading để không treo trang

      return () => unsubscribe();
    }
  }, [user]);

  const actualHours = Math.floor(stats.totalWatchSeconds / 3600);
  const userRank = getRankInfo(stats.totalWatchSeconds);
  // Hạng kế tiếp và số giờ còn thiếu (ngưỡng khớp getRankInfo trong AuthContext)
  const nextThreshold = RANK_STEPS.find((h) => actualHours < h);
  const prevThreshold = [...RANK_STEPS].reverse().find((h) => actualHours >= h) || 0;
  const nextRank = nextThreshold ? getRankInfo(nextThreshold * 3600) : null;
  const rankProgress = nextThreshold ? Math.min(100, Math.round(((actualHours - prevThreshold) / (nextThreshold - prevThreshold)) * 100)) : 100;

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.email?.split("@")[0] || "U")}&background=27272a&color=f4f4f5`;
  const savedMovies = (watchlist || []).map((m) => ({
    id: m.slug || m.id,
    title: m.name || m.title,
    image: m.thumb_url || m.image,
    thumb_url: m.thumb_url || m.image,
    year: m.year,
    quality: m.quality,
  }));

  return (
    <main className="relative mx-auto min-h-screen max-w-container-max px-4 pb-24 pt-24 sm:px-6">
      {/* Vệt loang màu thương hiệu ở đầu trang (Vivid) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand/[0.12] via-accent-to/[0.04] to-transparent" aria-hidden="true" />
      {/* Đầu trang: người dùng */}
      <section className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <img
          src={user?.photoURL || avatarFallback}
          onError={(e) => { e.currentTarget.src = avatarFallback; }}
          alt=""
          className="size-16 rounded-full object-cover ring-1 ring-white/10 sm:size-20"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{user?.displayName || user?.email?.split("@")[0]}</h1>
          <p className="mt-0.5 truncate text-sm text-fg-2">{user?.email}</p>
          {loading
            ? <div className="skeleton mt-2 h-4 w-28 rounded-full" />
            : <p className={`mt-1.5 text-sm font-medium ${userRank.color}`}>{userRank.icon} {userRank.name}</p>}
        </div>
        <button
          onClick={logout}
          className="flex h-10 items-center gap-2 self-start rounded-lg px-3.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 sm:self-center"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Đăng xuất
        </button>
      </section>

      {/* Số liệu */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-5">
          <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-cat-1/15 text-cat-1" aria-hidden="true">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
          </span>
          <p className="text-sm text-fg-2">Phim đã xem</p>
          {loading ? <div className="skeleton mt-2 h-8 w-16 rounded-md" /> : <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{stats.watchedCount}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-cat-2/15 text-cat-2" aria-hidden="true">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
          </span>
          <p className="text-sm text-fg-2">Giờ xem</p>
          {loading ? <div className="skeleton mt-2 h-8 w-16 rounded-md" /> : <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{actualHours}</p>}
        </div>
        {/* Khối hero của trang (Vivid): viền gradient, thanh tiến độ gradient */}
        <div className="hero-border col-span-2 rounded-2xl p-5 sm:col-span-1">
          <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-white/10 text-lg" aria-hidden="true">{loading ? "" : (nextRank ? nextRank.icon : userRank.icon)}</span>
          <p className="text-sm text-fg-2">{loading ? "Danh hiệu kế tiếp" : nextRank ? `Lên “${nextRank.name}”` : "Danh hiệu cao nhất"}</p>
          {loading ? (
            <div className="skeleton mt-2 h-8 w-24 rounded-md" />
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">
                {nextRank ? <>còn {nextThreshold - actualHours} <span className="text-base font-normal text-fg-2">giờ</span></> : `${userRank.icon} ${userRank.name}`}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={rankProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ lên hạng">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent-to" style={{ width: `${rankProgress}%` }} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Bảng danh hiệu: mở ra khi cần, không chiếm chỗ */}
      <details className="group mt-3 rounded-2xl border border-line bg-card">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-5 text-sm text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
          Hệ thống danh hiệu theo giờ xem
          <span className="material-symbols-outlined text-[20px] transition-transform group-open:rotate-180">expand_more</span>
        </summary>
        <ul className="grid gap-x-8 gap-y-2 px-5 pb-5 text-sm sm:grid-cols-2">
          {[0, ...RANK_STEPS].map((h, i) => {
            const r = getRankInfo(h * 3600);
            const to = RANK_STEPS[i];
            return (
              <li key={h} className="flex items-center justify-between gap-3">
                <span className={r.color}>{r.icon} {r.name}</span>
                <span className="tabular-nums text-fg-3">{to ? `${h}–${to} giờ` : `từ ${h} giờ`}</span>
              </li>
            );
          })}
        </ul>
      </details>

      {/* Phim yêu thích */}
      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-fg">
          Phim yêu thích {savedMovies.length > 0 && <span className="ml-1 text-sm font-normal text-fg-3">{savedMovies.length}</span>}
        </h2>
        {savedMovies.length > 0 ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {savedMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line px-6 py-16 text-center">
            <span className="material-symbols-outlined mb-3 text-[40px] text-fg-3">favorite</span>
            <p className="text-base font-medium text-fg">Chưa lưu phim nào</p>
            <p className="mt-1 text-sm text-fg-2">Bấm “Lưu phim” ở trang phim để xem lại sau.</p>
            <Link to="/search" className="mt-5 flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-white/5">
              Mở kho phim
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
