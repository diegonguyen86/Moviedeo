import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import LoadingLogo from './LoadingLogo';

export default function ForcePasswordSetup() {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updatePassword(user, password);
      setSuccess(true);
      // Khi updatePassword thành công, reload lại trang để AuthContext cập nhật providerData
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Phiên đăng nhập đã cũ. Vui lòng tải lại trang, đăng nhập lại bằng Google rồi thử đặt mật khẩu lần nữa.');
      } else {
        setError('Có lỗi xảy ra: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-white/20 rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] p-6 md:p-8">
        
        <div className="text-center mb-6">
          <span className="material-symbols-outlined text-5xl text-blue-500 mb-2 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">
            lock_person
          </span>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Bảo Mật Tài Khoản</h2>
          <p className="text-zinc-400 text-sm mt-2">
            Hệ thống đang chuyển sang đăng nhập 100% bằng Email. Vì bạn đang đăng nhập bằng Google, vui lòng **Tạo một Mật Khẩu** để có thể sử dụng được Mobile App và TV App nhé!
          </p>
        </div>

        {success ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-6xl text-emerald-500 mb-4 animate-bounce">check_circle</span>
            <h3 className="text-xl font-bold text-white mb-2">Thành Công!</h3>
            <p className="text-zinc-400">Đang đưa bạn vào hệ thống...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl text-red-500 text-sm text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider ml-1">Mật khẩu mới</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider ml-1">Nhập lại mật khẩu</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại cho chắc"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              ) : (
                <>LƯU MẬT KHẨU <span className="material-symbols-outlined text-xl">arrow_forward</span></>
              )}
            </button>
            
            <button
              type="button"
              onClick={logout}
              disabled={loading}
              className="w-full text-zinc-500 hover:text-white py-2 text-sm transition-colors mt-2"
            >
              Đăng xuất
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
