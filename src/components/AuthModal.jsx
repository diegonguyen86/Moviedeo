import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export default function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle } = useAuth();
  const { showToast } = useNotification();

  if (!isOpen) return null;

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast('Vui lòng nhập email!', 'error');
      return;
    }
    
    setLoading(true);
    try {
      if (mode === 'login') {
        if (!password) throw new Error('Vui lòng nhập mật khẩu!');
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === 'register') {
        if (!password || password.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự!');
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        showToast('Đã gửi link đặt lại mật khẩu. Vui lòng check mail!', 'success');
        setMode('login');
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        showToast('Email hoặc mật khẩu không chính xác.', 'error');
      } else if (err.code === 'auth/email-already-in-use') {
        showToast('Email này đã được đăng ký. Vui lòng đăng nhập.', 'error');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const result = await loginWithGoogle();
    if (result.success) {
      onClose();
    } else {
      if (result.reason === 'blocked') {
        showToast('Vui lòng tắt trình chặn quảng cáo (Adblock) để đăng nhập Google.', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/20 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)] p-6 md:p-8 animate-in zoom-in-95 duration-200">
        
        {/* Nút đóng */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
            {mode === 'login' ? 'ĐĂNG NHẬP' : mode === 'register' ? 'ĐĂNG KÝ MỚI' : 'QUÊN MẬT KHẨU'}
          </h2>
          <p className="text-zinc-400 text-sm">
            {mode === 'login' ? 'Truy cập kho phim siêu nét 4K' : mode === 'register' ? 'Tạo tài khoản để lưu phim yêu thích' : 'Nhập email để nhận link tạo lại mật khẩu'}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div className="space-y-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email của bạn"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-all"
              disabled={loading}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-all"
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              mode === 'login' ? 'ĐĂNG NHẬP' : mode === 'register' ? 'ĐĂNG KÝ' : 'GỬI LINK'
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-zinc-500 text-xs font-bold">HOẶC</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <button 
          onClick={handleGoogleAuth}
          className="w-full bg-white hover:bg-zinc-200 text-black py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 mb-6"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Tiếp tục với Google
        </button>

        <div className="text-center text-sm space-y-2">
          {mode === 'login' ? (
            <>
              <p className="text-zinc-400">
                Chưa có tài khoản? <button onClick={() => setMode('register')} className="text-white hover:underline font-bold">Đăng ký ngay</button>
              </p>
              <button onClick={() => setMode('forgot')} className="text-zinc-500 hover:text-white transition-colors">Quên mật khẩu?</button>
            </>
          ) : (
            <p className="text-zinc-400">
              Đã có tài khoản? <button onClick={() => setMode('login')} className="text-white hover:underline font-bold">Đăng nhập</button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
