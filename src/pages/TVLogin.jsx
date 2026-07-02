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
    <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center p-6">
      <div className="bg-[#1f1f1f] border border-gray-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
        <h2 className="text-3xl font-black mb-2 text-red-600 uppercase tracking-widest">Phim Hay Quá Trời TV</h2>
        <p className="text-gray-400 mb-8">Đăng nhập cực nhanh trên Smart TV của bạn</p>

        {status === 'success' ? (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-20 h-20 bg-green-600/20 text-green-500 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Thành công!</h3>
            <p className="text-gray-400 mb-6">TV của bạn đã được đăng nhập. Hãy kiểm tra màn hình TV.</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg w-full transition-colors"
            >
              Quay lại Trang Chủ
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-red-600/10 text-red-500 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
            
            <p className="text-gray-300 font-medium mb-6">Nhập mã hiển thị trên TV của bạn:</p>
            
            <div className="relative w-full mb-2 flex justify-center gap-2 sm:gap-4">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const char = code[index] || '';
                const isActive = code.length === index || (code.length === 6 && index === 5);
                return (
                  <div 
                    key={index} 
                    className={`w-12 h-16 sm:w-14 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl font-black uppercase rounded-xl transition-all duration-300
                      ${char ? 'bg-red-600 text-white border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-110' : 'bg-[#141414] border border-gray-700 text-gray-500'}
                      ${isActive && !char ? 'border-2 border-red-500 bg-[#1a1a1a]' : ''}
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
              <p className="text-red-500 text-sm font-medium mt-4 mb-2 w-full text-center">{errorMessage}</p>
            )}

            <button 
              onClick={handleApprove}
              disabled={status === 'loading' || code.length < 6}
              className={`mt-6 w-full py-4 rounded-xl font-bold text-lg transition-all flex justify-center items-center ${code.length === 6 ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
            >
              {status === 'loading' ? (
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'CẤP QUYỀN ĐĂNG NHẬP'
              )}
            </button>
            <p className="text-gray-500 text-xs mt-4">
              Bằng cách cấp quyền, TV sẽ đăng nhập dưới tài khoản {user?.email || 'của bạn'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
