import { useState, useEffect } from "react";

export default function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Để popup hiện lên mượt mà sau khi trang load
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Hình nền */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-screen"
          style={{ backgroundImage: "url('/cute-bg.png')" }}
        />
        
        {/* Lớp gradient làm tối để chữ dễ đọc */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/80 to-zinc-900/40" />

        <div className="relative p-8 md:p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)]">
            <span className="material-symbols-outlined text-4xl text-primary animate-pulse">volunteer_activism</span>
          </div>

          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Chào các ní iu! 👋</h2>
          
          <div className="space-y-4 text-zinc-300 font-medium leading-relaxed mb-8">
            <p className="text-lg">
              Trang web được tạo ra <b className="text-white">phi lợi nhuận</b> nên không hề có quảng cáo, để trải nghiệm tốt nhất vui lòng <b className="text-primary">tắt chặn quảng cáo</b> khi xem phim nhé!
            </p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 italic text-sm text-zinc-400">
              <span className="font-bold text-zinc-300">P/s:</span> Quảng cáo chạy trong phim đến từ các nguồn phim, web của tui không hề gắn 1 quảng cáo hay kiếm được đồng nào từ quảng cáo trong phim đâu nha 🥺
            </div>
          </div>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-full sm:w-auto px-10 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold transition-all shadow-xl active:scale-95"
          >
            TUI ĐÃ HIỂU, ĐÓNG LẠI!
          </button>
        </div>
      </div>
    </div>
  );
}
