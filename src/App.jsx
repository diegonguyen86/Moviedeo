import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext"; 
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import MovieDetail from "./pages/MovieDetail";
import UserProfile from "./pages/UserProfile";
import VideoPlayer from "./pages/VideoPlayer";
import BrowsePage from "./pages/BrowsePage";
// 1. IMPORT TRANG ADMIN BÍ MẬT
import AdminSecret from "./pages/AdminSecret";

function App() {
  return (
    <AuthProvider> 
      <HashRouter>
        <Routes>
          {/* Toàn bộ các trang nằm trong Layout sẽ được bảo vệ bởi logic "Duyệt" */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="movie/:id" element={<MovieDetail />} />
            <Route path="search" element={<BrowsePage />} />
            <Route path="profile" element={<UserProfile />} />
            
            {/* 2. THÊM ROUTE ADMIN VÀO ĐÂY */}
            <Route path="admin-secret" element={<AdminSecret />} />
          </Route>

          {/* Trang xem phim (Tự bảo vệ bên trong component) */}
          <Route path="/play/:id" element={<VideoPlayer />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;