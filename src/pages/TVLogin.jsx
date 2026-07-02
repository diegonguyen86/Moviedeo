import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

export default function TVLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const initialCode = searchParams.get('code') || '';
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  // Nếu người dùng chưa đăng nhập web, chuyển họ về trang chủ để đăng nhập trước
  useEffect(() => {
    if (user === null) {
      // Auth context usually starts undefined, then sets user or null
      // We assume user is null if not logged in
      const timer = setTimeout(() => {
        if (!auth.currentUser) {
          alert("Vui lòng đăng nhập trên điện thoại/web trước khi cấp quyền cho TV.");
          navigate('/');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, navigate]);

  const handleApprove = async () => {
    if (!code || code.length < 6) {
      setErrorMessage("Mã kết nối không hợp lệ");
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

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error || "Đã xảy ra lỗi không xác định");
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage("Không thể kết nối đến máy chủ");
    }
  };

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1925&auto=format&fit=crop')] bg-cover bg-center text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background mờ ảo cho glassmorphism */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-0"></div>
      
      <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/20 p-8 rounded-3xl max-w-md w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-widest drop-shadow-md">Phim Hay Quá Trời TV</h2>
        <p className="text-zinc-400 mb-8">Đăng nhập cực nhanh trên Smart TV của bạn</p>

        {status === 'success' ? (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 text-green-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Thành công!</h3>
            <p className="text-zinc-400 mb-6">TV của bạn đã được đăng nhập. Hãy kiểm tra màn hình TV.</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-white/20 border border-white/30 backdrop-blur-md hover:bg-white/30 text-white font-bold py-3 px-8 rounded-xl w-full transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
            >
              Quay lại Trang Chủ
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-white/10 text-white rounded-full flex items-center justify-center mb-8 border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
            
            <p className="text-zinc-300 font-medium mb-6 drop-shadow-md">Nhập mã hiển thị trên TV của bạn:</p>
            
            <div className="relative w-full mb-2 flex justify-center gap-2 sm:gap-4">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const char = code[index] || '';
                const isActive = code.length === index || (code.length === 6 && index === 5);
                return (
                  <div 
                    key={index} 
                    className={`w-12 h-16 sm:w-14 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl font-black uppercase rounded-xl transition-all duration-300 backdrop-blur-md
                      ${char ? 'bg-white/20 text-white border border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)] scale-110' : 'bg-white/5 border border-white/10 text-zinc-500'}
                      ${isActive && !char ? 'border-2 border-white/50 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}
                    `}
                  >
                    {char}
                  </div>
                );
              })}
              
              {/* Thẻ input thật bị ẩn đi, nhưng vẫn bắt sự kiện gõ phím */}
              <input 
                type="text" 
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            
            {status === 'error' && (
              <p className="text-error text-sm font-medium mt-4 mb-2 w-full text-center drop-shadow-md">{errorMessage}</p>
            )}

            <button 
              onClick={handleApprove}
              disabled={status === 'loading' || code.length < 6}
              className={`mt-6 w-full py-4 rounded-2xl font-bold text-lg transition-all flex justify-center items-center backdrop-blur-md border border-white/20 ${code.length === 6 ? 'bg-white/20 hover:bg-white/30 text-white shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95' : 'bg-white/5 text-zinc-500 cursor-not-allowed border-white/5'}`}
            >
              {status === 'loading' ? (
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'XÁC NHẬN'
              )}
            </button>
            <p className="text-zinc-500 text-xs mt-4">
              Bằng cách xác nhận, TV sẽ đăng nhập dưới tài khoản {user?.email || 'của bạn'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
