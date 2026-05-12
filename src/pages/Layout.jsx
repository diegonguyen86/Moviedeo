import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  // BỔ SUNG: Lấy thêm hàm logout từ useAuth
  const { user, isApproved, loginWithGoogle, logout } = useAuth();

  // 1. NẾU CHƯA ĐĂNG NHẬP: Bắt buộc đăng nhập
  if (!user) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white px-6">
        <div className="max-w-md text-center space-y-8">
          <h1 className="text-5xl font-black text-primary uppercase tracking-tighter">KHO ẢNH CAO CẤP</h1>
          <p className="text-zinc-500 font-medium italic">Vui lòng đăng nhập để khám phá bộ sưu tập thư viện ảnh nhé!</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-primary hover:bg-primary-fixed text-white py-4 rounded-2xl font-black transition-all shadow-[0_10px_40px_rgba(var(--primary-rgb),0.3)] active:scale-95"
          >
            ĐĂNG NHẬP BẰNG GOOGLE
          </button>
        </div>
      </div>
    );
  }

  // 2. NẾU ĐÃ ĐĂNG NHẬP NHƯNG CHƯA ĐƯỢC DUYỆT: Hiện màn hình chờ + Nút Đăng xuất
  if (user && !isApproved) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white px-6">
        <div className="max-w-xl text-center space-y-6">
          <span className="material-symbols-outlined text-8xl text-primary animate-pulse">lock_person</span>
          <h2 className="text-4xl font-black uppercase tracking-tighter text-primary">DỪNG LẠI NÍ ƠI!</h2>
          
          <div className="space-y-2">
            <p className="text-xl text-zinc-300 font-bold">Tài khoản của bạn đang chờ phê duyệt.</p>
            <p className="text-zinc-500">Vì lý do bảo mật và tránh share tràn lan, vui lòng liên hệ Admin để được cấp quyền truy cập nhé!</p>
          </div>

          <div className="flex flex-col gap-4 mt-8">
            {/* Nút kiểm tra lại */}
            <button 
              onClick={() => window.location.reload()}
              className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold transition-all uppercase text-sm border border-white/5"
            >
              Tôi đã liên hệ, kiểm tra lại ngay
            </button>

            {/* NÚT THOÁT HIỂM: Giải quyết vấn đề không thể Logout */}
            <button 
              onClick={logout}
              className="text-zinc-500 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-all"
            >
              Sử dụng tài khoản khác (Đăng xuất)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. NẾU ĐÃ ĐĂNG NHẬP VÀ ĐÃ ĐƯỢC DUYỆT: Cho phép vào xem
  return (
    <>
      <Header />
      {/* Thêm div bọc để tránh nội dung bị Header che mất nếu Header là fixed */}
      <div className="min-h-screen bg-black">
        <Outlet />
      </div>
    </>
  );
}
