import { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

// Người dùng Google cũ phải tạo mật khẩu để dùng được app điện thoại / TV (đăng nhập bằng email).
// Theo evon layouts/form.md: một ô mật khẩu có nút xem lại, không có ô "nhập lại".
export default function ForcePasswordSetup() {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updatePassword(auth.currentUser || user, password);
      setSuccess(true);
      // Tải lại trang để AuthContext cập nhật providerData
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Phiên đăng nhập đã cũ. Đăng xuất, đăng nhập lại bằng Google rồi tạo mật khẩu lần nữa.');
      } else {
        setError('Chưa lưu được mật khẩu, thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Phim Hay Quá Trời" className="mb-6 size-12 object-contain" />

        {success ? (
          <div role="status">
            <span className="material-symbols-outlined mb-3 text-[40px] text-emerald-400">check_circle</span>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Đã tạo mật khẩu</h1>
            <p className="mt-2 text-[15px] text-fg-2">Đang đưa bạn vào web…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Tạo mật khẩu</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
              Bạn đang đăng nhập bằng Google. Tạo thêm mật khẩu cho <span className="font-medium text-fg">{user?.email}</span> để đăng nhập được app điện thoại và app TV.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-fg">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    className="h-12 w-full rounded-xl border border-line-strong bg-card px-3.5 pr-12 text-[15px] text-fg placeholder:text-fg-3 transition-colors focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/10 disabled:opacity-60"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-fg-3 transition-colors hover:text-fg"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70"
              >
                {loading && <span className="material-symbols-outlined animate-spin text-[20px] motion-reduce:animate-none">progress_activity</span>}
                Lưu mật khẩu
              </button>
            </form>

            <button
              type="button"
              onClick={logout}
              disabled={loading}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              Đăng xuất
            </button>
          </>
        )}
      </div>
    </main>
  );
}
