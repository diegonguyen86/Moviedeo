import { Outlet, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { useEffect, Suspense } from "react";
import AuthForm from "../components/AuthModal";
import LoadingLogo from "../components/LoadingLogo";
import ForcePasswordSetup from "../components/ForcePasswordSetup";

export default function Layout() {
  const { user, isApproved, logout, hasPassword } = useAuth();
  const navigate = useNavigate();

  // Người dùng mở link đăng nhập TV khi chưa đăng nhập web -> sau khi đăng nhập xong, đưa họ quay lại /tv
  useEffect(() => {
    if (user && isApproved && hasPassword && sessionStorage.getItem("tv_pending_code")) {
      navigate("/tv", { replace: true });
    }
  }, [user, isApproved, hasPassword, navigate]);

  // 1. NẾU CHƯA ĐĂNG NHẬP: Bắt buộc đăng nhập
  if (!user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-5 py-12">
        <AuthForm />
      </main>
    );
  }

  // 2. NẾU ĐÃ ĐĂNG NHẬP NHƯNG CHƯA ĐƯỢC DUYỆT: màn chờ duyệt.
  // Trạng thái duyệt cập nhật real-time (Firestore), nên admin duyệt xong là tự vào, không cần tải lại.
  if (user && !isApproved) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-5 py-12">
        <div className="w-full max-w-sm">
          <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Phim Hay Quá Trời" className="mb-6 size-12 object-contain" />
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Đang chờ duyệt</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
            Tài khoản <span className="font-medium text-fg">{user.email}</span> đã được tạo. Admin đã nhận được thông báo, duyệt xong là bạn vào xem được ngay — trang này tự cập nhật.
          </p>
          <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3.5 py-3 text-sm text-fg-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-amber-400" />
            </span>
            Đang chờ admin duyệt
          </div>
          <div className="mt-8 flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex h-12 items-center justify-center rounded-xl border border-line-strong text-[15px] font-medium text-fg transition-colors hover:bg-white/5"
            >
              Kiểm tra lại
            </button>
            <button
              onClick={logout}
              className="flex h-12 items-center justify-center rounded-xl text-[15px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              Đăng xuất, dùng tài khoản khác
            </button>
          </div>
        </div>
      </main>
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
      <div className="min-h-screen bg-canvas">
        {/* Suspense riêng cho phần nội dung: chuyển trang thì Header vẫn đứng yên, chỉ phần dưới hiện loading */}
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingLogo className="w-12 h-12" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </div>
    </>
  );
}