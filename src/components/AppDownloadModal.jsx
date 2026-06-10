import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AppDownloadModal({ isOpen, onClose }) {
  // Animation state
  const [show, setShow] = useState(false);
  const [appLinks, setAppLinks] = useState({ android: "", ios: "", tv: "" });

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = "hidden"; // Prevent scrolling
      
      // Lấy link tải từ Firebase
      const fetchLinks = async () => {
        try {
          const docRef = doc(db, "admin_settings", "app_links");
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setAppLinks(docSnap.data());
          }
        } catch (error) {
          console.error("Lỗi khi lấy link tải:", error);
        }
      };
      fetchLinks();
    } else {
      setTimeout(() => setShow(false), 300); // Wait for fade out
      document.body.style.overflow = "auto";
    }
  }, [isOpen]);

  if (!isOpen && !show) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className={`relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-[400px] text-center shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-transform duration-300 ${isOpen ? "translate-y-0 scale-100" : "translate-y-8 scale-95"}`}>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="flex flex-col items-center mb-6 mt-2">
          <img 
            src={`${import.meta.env.BASE_URL}icon.png`} 
            alt="App Phim Hay Quá Trời" 
            className="w-20 h-20 rounded-2xl mb-4 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          />
          <h2 className="text-2xl font-bold text-white mb-2">Phim Hay Quá Trời</h2>
          <p className="text-zinc-400 text-sm leading-relaxed px-4">
            Trải nghiệm xem phim mượt mà hơn, không giật lag trên thiết bị di động của bạn.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Android Download */}
          {appLinks.android ? (
            <a 
              href={appLinks.android} 
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 bg-[#3ddc84] text-black font-semibold py-3.5 px-4 rounded-xl transition-transform hover:-translate-y-0.5 shadow-lg shadow-[#3ddc84]/20"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.244 13.8533 7.8546 12 7.8546c-1.8533 0-3.5902.3894-5.1367 1.0954L4.841 5.447a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.44z"/></svg>
              <span>Tải file APK (Android)</span>
            </a>
          ) : (
            <button disabled className="flex items-center justify-center gap-3 bg-zinc-800 text-zinc-500 font-semibold py-3.5 px-4 rounded-xl cursor-not-allowed">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.244 13.8533 7.8546 12 7.8546c-1.8533 0-3.5902.3894-5.1367 1.0954L4.841 5.447a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.44z"/></svg>
              <span>Android (Đang cập nhật)</span>
            </button>
          )}

          {/* iOS Download */}
          {appLinks.ios ? (
            <a 
              href={appLinks.ios} 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 bg-white text-black font-semibold py-3.5 px-4 rounded-xl transition-transform hover:-translate-y-0.5 shadow-lg shadow-white/20"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16.365 21.439c-1.424.966-2.584.872-3.877.01-1.282-.857-2.673-.896-4.043.013-1.884 1.258-3.323.518-4.498-1.25-2.73-4.12-3.66-9.134-1.636-12.72 1.134-2.003 2.946-3.136 4.963-3.174 1.706-.033 3.238.995 4.148 1.054.912.06 2.687-1.127 4.707-1.026 1.834.053 3.407.785 4.394 2.115-3.626 2.05-3.084 6.814.395 8.192-1.035 2.502-2.316 4.887-4.553 6.786zm-2.825-18.423c-.782 1.028-2.062 1.637-3.342 1.503-.232-1.393.425-2.756 1.233-3.699.82-.988 2.146-1.632 3.37-1.488.225 1.346-.43 2.683-1.261 3.684z"/></svg>
              <span>Tải cho iOS (Sideload)</span>
            </a>
          ) : (
            <button 
              className="flex items-center justify-center gap-3 bg-zinc-800 border border-zinc-700 text-zinc-500 font-semibold py-3.5 px-4 rounded-xl cursor-not-allowed"
              onClick={() => alert('Bản IPA sẽ sớm được cập nhật.')}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16.365 21.439c-1.424.966-2.584.872-3.877.01-1.282-.857-2.673-.896-4.043.013-1.884 1.258-3.323.518-4.498-1.25-2.73-4.12-3.66-9.134-1.636-12.72 1.134-2.003 2.946-3.136 4.963-3.174 1.706-.033 3.238.995 4.148 1.054.912.06 2.687-1.127 4.707-1.026 1.834.053 3.407.785 4.394 2.115-3.626 2.05-3.084 6.814.395 8.192-1.035 2.502-2.316 4.887-4.553 6.786zm-2.825-18.423c-.782 1.028-2.062 1.637-3.342 1.503-.232-1.393.425-2.756 1.233-3.699.82-.988 2.146-1.632 3.37-1.488.225 1.346-.43 2.683-1.261 3.684z"/></svg>
              <span>iOS (Đang cập nhật)</span>
            </button>
          )}

          {/* Smart TV Download */}
          {appLinks.tv ? (
            <a 
              href={appLinks.tv} 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 bg-[#e50914] text-white font-semibold py-3.5 px-4 rounded-xl transition-transform hover:-translate-y-0.5 shadow-lg shadow-[#e50914]/20 mt-2"
            >
              <span className="material-symbols-outlined text-[22px]">tv</span>
              <span>Tải file APK (Smart TV)</span>
            </a>
          ) : (
            <button 
              disabled
              className="flex items-center justify-center gap-3 bg-zinc-800 border border-zinc-700 text-zinc-500 font-semibold py-3.5 px-4 rounded-xl cursor-not-allowed mt-2"
            >
              <span className="material-symbols-outlined text-[22px]">tv</span>
              <span>Smart TV (Sắp ra mắt)</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
