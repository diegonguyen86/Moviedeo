import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

export default function Layout() {
  const { user, isApproved, loginWithGoogle, logout } = useAuth();
  
  const [showAdblockModal, setShowAdblockModal] = useState(false);
  const [isCheckingAdblock, setIsCheckingAdblock] = useState(false);

  const detectAdblock = () => {
    return new Promise((resolve) => {
      // Lớp 1: Bẫy tàng hình DOM (Bắt uBlock, Adblock Plus)
      const ad = document.createElement('div');
      ad.innerHTML = '&nbsp;';
      ad.className = 'adsbox ad-placement doubleclick ad-placeholder';
      ad.style.position = 'absolute';
      ad.style.top = '-1000px';
      document.body.appendChild(ad);
      
      setTimeout(() => {
        const isDomBlocked = window.getComputedStyle(ad).display === 'none' || ad.offsetHeight === 0;
        document.body.removeChild(ad);
        resolve(isDomBlocked);
      }, 100); 
    });
  };

  const handleLoginClick = async () => {
    setIsCheckingAdblock(true);
    const hasAdblock = await detectAdblock();
    setIsCheckingAdblock(false);

    if (hasAdblock) {
      setShowAdblockModal(true);
    } else {
      setShowAdblockModal(false);
      const result = await loginWithGoogle();
      if (result && result.reason === 'blocked') {
        setShowAdblockModal(true);
      }
    }
  };
  
  useEffect(() => {
    // Chỉ kiểm tra khi ở màn hình chưa đăng nhập
    if (!user) {
      detectAdblock().then(hasAdblock => {
        if (hasAdblock) {
          setShowAdblockModal(true);
        }
      });
    }
  }, [user]);

  // 1. NẾU CHƯA ĐĂNG NHẬP: Bắt buộc đăng nhập
  if (!user) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white px-6">
        
        {/* Adblock Modal */}
        {showAdblockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
            <div className="relative w-full max-w-md bg-zinc-900 border border-red-500/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)] p-6 md:p-8 text-center animate-in zoom-in-95 duration-200">
              <span className="material-symbols-outlined text-6xl text-red-500 mb-4 animate-bounce">gpp_bad</span>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Phát hiện Adblock!</h2>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Hệ thống phát hiện bạn đang sử dụng <b>Trình chặn quảng cáo (Adblock)</b> hoặc trình duyệt <b>Brave</b>. Điều này sẽ khiến cửa sổ đăng nhập bị lỗi.
                <br/><br/>
                Vui lòng <span className="text-white font-bold">TẮT TRÌNH CHẶN QUẢNG CÁO</span> cho trang web này để tiếp tục!
              </p>
              <button 
                onClick={handleLoginClick}
                disabled={isCheckingAdblock}
                className="w-full bg-white text-black hover:bg-zinc-200 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isCheckingAdblock ? (
                  <><span className="material-symbols-outlined animate-spin">progress_activity</span> Đang quét lại...</>
                ) : "TÔI ĐÃ TẮT, KIỂM TRA LẠI"}
              </button>
            </div>
          </div>
        )}

        <div className="max-w-md text-center space-y-8">
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-md">KHO ẢNH CAO CẤP</h1>
          <p className="text-zinc-500 font-medium italic">Vui lòng đăng nhập để khám phá bộ sưu tập thư viện ảnh nhé!</p>
          <button 
            onClick={handleLoginClick}
            disabled={isCheckingAdblock}
            className="w-full bg-white/20 border border-white/30 backdrop-blur-md hover:bg-white/30 text-white py-4 rounded-2xl font-black transition-all shadow-[0_10px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
          >
            {isCheckingAdblock ? (
              <><span className="material-symbols-outlined animate-spin">progress_activity</span> Đang kiểm tra bảo mật...</>
            ) : "ĐĂNG NHẬP BẰNG GOOGLE"}
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