import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import ScrollToTop from "./components/ScrollToTop";
import LiveCommentTicker from "./components/LiveCommentTicker";
import DevToolsGuard from "./components/DevToolsGuard";
import LoadingLogo from "./components/LoadingLogo";

// TẢI THEO TRANG (code-splitting): trước đây toàn bộ web (kể cả trình phát hls.js ~500KB và trang Admin)
// gộp vào 1 file JS ~1.3MB phải tải xong mới hiện được trang chủ. Giờ trang nào mở mới tải trang đó.
const MovieDetail = lazy(() => import("./pages/MovieDetail"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const VideoPlayer = lazy(() => import("./pages/VideoPlayer"));
const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const TVLogin = lazy(() => import("./pages/TVLogin"));
const TrendingManage = lazy(() => import("./pages/TrendingManage"));
const AppLinksManage = lazy(() => import("./pages/AppLinksManage"));

// Khi trình duyệt rảnh (sau khi trang chủ đã hiện), tải sẵn các trang hay dùng -> bấm vào là mở ngay
if (typeof window !== "undefined") {
  const prefetch = () => {
    import("./pages/MovieDetail");
    import("./pages/BrowsePage");
    import("./pages/VideoPlayer");
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(prefetch, { timeout: 4000 });
  else setTimeout(prefetch, 3000);
}

const PageFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <LoadingLogo className="w-12 h-12" />
  </div>
);

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <DevToolsGuard />
        <BrowserRouter>
          <ScrollToTop />
          <LiveCommentTicker />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Toàn bộ các trang nằm trong Layout sẽ được bảo vệ bởi logic "Duyệt" */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="movie/:id" element={<MovieDetail />} />
                <Route path="search" element={<BrowsePage />} />
                <Route path="profile" element={<UserProfile />} />

                {/* Trang Admin (tự kiểm tra quyền bên trong) */}
                <Route path="admin/trending" element={<TrendingManage />} />
                <Route path="admin/app-links" element={<AppLinksManage />} />
              </Route>

              {/* Trang xem phim (Tự bảo vệ bên trong component: phải đăng nhập + được duyệt) */}
              <Route path="/play/:id" element={<VideoPlayer />} />

              {/* Trang đăng nhập TV (Không có Menu) */}
              <Route path="/tv" element={<TVLogin />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
