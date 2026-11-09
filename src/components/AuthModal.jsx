import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Form đăng nhập / đăng ký / quên mật khẩu, đặt thẳng giữa màn (evon layouts/form.md, bố cục A).
// Trước đây phải bấm một nút để mở hộp đăng nhập -> thừa một bước.

const ERROR_TEXT = {
  'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu chưa đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu chưa đúng.',
  'auth/invalid-email': 'Email chưa đúng định dạng.',
  'auth/email-already-in-use': 'Email này đã có tài khoản. Hãy đăng nhập.',
  'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
  'auth/too-many-requests': 'Bạn thử quá nhiều lần. Đợi vài phút rồi thử lại.',
  'auth/network-request-failed': 'Không kết nối được. Kiểm tra mạng rồi thử lại.',
};

const inputClass =
  'h-12 w-full rounded-xl border border-line-strong bg-card px-3.5 text-[15px] text-fg placeholder:text-fg-3 transition-colors focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/10 disabled:opacity-60';

export default function AuthForm() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { loginWithGoogle } = useAuth();

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim()) return setError('Nhập email của bạn.');
    if (mode !== 'forgot' && !password) return setError('Nhập mật khẩu.');
    if (mode === 'register' && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice(`Đã gửi link đặt lại mật khẩu tới ${email.trim()}. Mở email để tiếp tục.`);
        setMode('login');
      }
    } catch (err) {
      setError(ERROR_TEXT[err.code] || 'Có lỗi xảy ra, thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    // Google chặn đăng nhập trong trình duyệt nhúng của Zalo / Messenger / Facebook / Instagram / TikTok
    if (/Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|TikTok|musical_ly|; wv\)/i.test(navigator.userAgent)) {
      setError('Google không cho đăng nhập trong trình duyệt của Zalo/Messenger. Bấm ⋮ → "Mở bằng trình duyệt" (Chrome/Safari) rồi thử lại, hoặc dùng email.');
      return;
    }
    const result = await loginWithGoogle();
    if (!result.success && result.reason === 'blocked') {
      setError('Không mở được cửa sổ đăng nhập Google. Tắt chặn popup / chặn quảng cáo rồi thử lại.');
    }
  };

  const title = mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Quên mật khẩu';
  const submitText = mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Gửi link đặt lại';

  return (
    <div className="w-full max-w-sm">
      <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Phim Hay Quá Trời" className="mb-6 size-12 object-contain" />
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="mt-1.5 text-sm text-fg-2">
        {mode === 'forgot'
          ? 'Nhập email đã đăng ký, mình gửi link đặt lại mật khẩu.'
          : mode === 'register'
            ? 'Tài khoản mới cần admin duyệt trước khi xem phim.'
            : 'Kho phim riêng cho bạn bè, không quảng cáo.'}
      </p>

      {notice && (
        <p role="status" className="mt-5 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-300">{notice}</p>
      )}

      <form onSubmit={handleEmailAuth} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-fg">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@email.com"
            className={inputClass}
            disabled={loading}
          />
        </div>

        {mode !== 'forgot' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="auth-password" className="text-sm font-medium text-fg">Mật khẩu</label>
              {mode === 'login' && (
                <button type="button" onClick={() => switchMode('forgot')} className="text-sm text-fg-2 transition-colors hover:text-fg">
                  Quên mật khẩu?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Ít nhất 6 ký tự' : 'Mật khẩu của bạn'}
                className={`${inputClass} pr-12`}
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
        )}

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70"
        >
          {loading && <span className="material-symbols-outlined animate-spin text-[20px] motion-reduce:animate-none">progress_activity</span>}
          {submitText}
        </button>
      </form>

      {mode !== 'forgot' && (
        <>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-fg-3">hoặc</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={handleGoogleAuth}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-strong text-[15px] font-medium text-fg transition-colors hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
            {mode === 'register' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google'}
          </button>
        </>
      )}

      <p className="mt-8 text-sm text-fg-2">
        {mode === 'login' ? (
          <>Chưa có tài khoản? <button type="button" onClick={() => switchMode('register')} className="font-medium text-fg hover:underline">Tạo tài khoản</button></>
        ) : (
          <>Đã có tài khoản? <button type="button" onClick={() => switchMode('login')} className="font-medium text-fg hover:underline">Đăng nhập</button></>
        )}
      </p>
    </div>
  );
}
