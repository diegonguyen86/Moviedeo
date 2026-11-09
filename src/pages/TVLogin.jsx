import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

export default function TVLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const initialCode = searchParams.get('code') || sessionStorage.getItem('tv_pending_code') || '';
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  // Nếu người dùng chưa đăng nhập web, chuyển họ về trang chủ để đăng nhập trước
  // AuthProvider chỉ render trang này sau khi đã biết trạng thái đăng nhập, nên kiểm tra luôn
  useEffect(() => {
    if (!user) {
      if (code || initialCode) sessionStorage.setItem('tv_pending_code', code || initialCode);
      alert("Vui lòng đăng nhập trên điện thoại/web trước khi cấp quyền cho TV.");
      navigate('/', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const handleApprove = async () => {
    if (!code || code.length < 6) {
      setStatus('error');
      setErrorMessage("Mã kết nối không hợp lệ");
      return;
    }
    if (!auth.currentUser) {
      navigate('/', { replace: true });
      return;
    }

    try {
      setStatus('loading');
      
      // Lấy ID Token của user hiện tại
      const idToken = await auth.currentUser.getIdToken(true);
      
      // Gọi lên Vercel API
      const res = await fetch('/api/tv-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.trim(),
          idToken: idToken
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
        sessionStorage.removeItem('tv_pending_code');
      } else {
        setStatus('error');
        setErrorMessage(data.error || "Đã xảy ra lỗi không xác định");
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Phim Hay Quá Trời" className="mb-6 size-12 object-contain" />

        {status === 'success' ? (
          <div role="status">
            <span className="material-symbols-outlined mb-3 text-[40px] text-emerald-400">check_circle</span>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">TV đã đăng nhập</h1>
            <p className="mt-2 text-[15px] text-fg-2">Nhìn lên màn hình TV, phim đã sẵn sàng.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-8 flex h-12 w-full items-center justify-center rounded-xl border border-line-strong text-[15px] font-medium text-fg transition-colors hover:bg-white/5"
            >
              Về trang chủ
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Đăng nhập trên TV</h1>
            <p className="mt-2 text-[15px] text-fg-2">Nhập mã 6 ký tự đang hiện trên màn hình TV.</p>

            {/* Ô nhập mã: 6 ô hiển thị, một input thật phủ lên trên để gõ / dán */}
            <label htmlFor="tv-code" className="sr-only">Mã trên TV</label>
            <div className="relative mt-6 grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const char = code[index] || '';
                const isActive = code.length === index || (code.length === 6 && index === 5);
                return (
                  <div
                    key={index}
                    aria-hidden="true"
                    className={`flex aspect-[4/5] items-center justify-center rounded-xl border bg-card text-2xl font-semibold uppercase text-fg transition-colors ${
                      isActive ? 'border-white/50 ring-2 ring-white/10' : char ? 'border-line-strong' : 'border-line'
                    }`}
                  >
                    {char}
                  </div>
                );
              })}
              <input
                id="tv-code"
                type="text"
                inputMode="text"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); if (status === 'error') setStatus('idle'); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleApprove(); }}
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
                autoFocus
                autoComplete="one-time-code"
                spellCheck="false"
              />
            </div>

            {status === 'error' && <p role="alert" className="mt-3 text-sm text-red-400">{errorMessage}</p>}

            <button
              onClick={handleApprove}
              disabled={status === 'loading' || code.length < 6}
              className="btn-primary mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-40"
            >
              {status === 'loading' && <span className="material-symbols-outlined animate-spin text-[20px] motion-reduce:animate-none">progress_activity</span>}
              Xác nhận
            </button>
            <p className="mt-4 text-xs text-fg-3">TV sẽ đăng nhập bằng tài khoản {user?.email || 'của bạn'}.</p>
          </>
        )}
      </div>
    </main>
  );
}
