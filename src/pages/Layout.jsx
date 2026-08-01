import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import AuthModal from "../components/AuthModal";
import ForcePasswordSetup from "../components/ForcePasswordSetup";

export default function Layout() {
  const { user, isApproved, logout, hasPassword } = useAuth();
  
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 1. NẾU CHƯA ĐĂNG NHẬP: Bắt buộc đăng nhập
  if (!user) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white px-6">
        
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

        <div className="max-w-md text-center space-y-8">
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-md">PHIM HAY QUÁ TRỜI</h1>
          <p className="text-zinc-500 font-medium italic">Vui lòng đăng nhập để trải nghiệm xem phim đỉnh cao!</p>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black transition-all shadow-[0_10px_40px_rgba(220,38,38,0.2)] active:scale-95 flex items-center justify-center gap-2"
          >
            ĐĂNG NHẬP / ĐĂNG KÝ
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
          <span className="material-symbols-outlined text-8xl text-white animate-pulse">lock_person</span>
          <h2 className="text-4xl font-black uppercase tracking-tighter text-white">DỪNG LẠI NÍ ƠI!</h2>
          
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

  // 3. NẾU ĐÃ DUYỆT NHƯNG CHƯA CÓ MẬT KHẨU (GOOGLE USER CŨ)
  if (user && isApproved && !hasPassword) {
    return <ForcePasswordSetup />;
  }

  // 4. NẾU ĐÃ ĐĂNG NHẬP VÀ ĐÃ ĐƯỢC DUYỆT: Cho phép vào xem
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