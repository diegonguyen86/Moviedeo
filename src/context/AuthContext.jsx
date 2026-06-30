import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "../firebase"; 
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth"; 
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore"; 
import { useNotification } from "./NotificationContext";
import LoadingLogo from "../components/LoadingLogo";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 🤖 CON BOT TELEGRAM (ĐÃ FIX LINK VERCEL) ---
  const notifyAdmin = async (name, email, uid) => {
    const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;
    
    // Tự động lấy domain hiện tại (ví dụ: phimhayquatroi.vercel.app)
    const baseUrl = window.location.origin; 

    // SỬA LẠI ĐƯỜNG DẪN: Trỏ về /api/bot của Vercel thay vì Netlify
    const approveUrl = `${baseUrl}/api/bot?action=approve&uid=${uid}`;
    const declineUrl = `${baseUrl}/api/bot?action=decline&uid=${uid}`;

    const messageText = `<b>🍿 CÓ KHÁCH MỚI ĐĂNG KÝ!</b>\n\n` +
                        `👤 <b>Tên:</b> ${name}\n` +
                        `📧 <b>Email:</b> ${email}\n\n` +
                        `<i>Ông giáo Khôi bấm nút dưới đây để xử lý nhé:</i>`;

    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ DUYỆT NGAY", url: approveUrl },
                { text: "❌ CÚT", url: declineUrl }
              ]
            ]
          }
        }),
      });
      console.log("✅ Đã gửi báo cáo cho ông giáo!");
    } catch (error) {
      console.error("❌ Lỗi Bot:", error);
    }
  }; 

  useEffect(() => {
    let unsubsDoc = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        if (currentUser) {
          const userDocRef = doc(db, "users", currentUser.uid);
          
          unsubsDoc = onSnapshot(userDocRef, async (docSnap) => {
            if (!docSnap.exists()) {
              // TẠO MỚI KHI LẦN ĐẦU ĐĂNG NHẬP
              await setDoc(userDocRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                isApproved: false,
                createdAt: new Date().toISOString()
              });
              setIsApproved(false);
              setUserData(null);
              // Gửi thông báo cho Admin (Chỉ gửi 1 lần duy nhất lúc này)
              await notifyAdmin(currentUser.displayName, currentUser.email, currentUser.uid);
            } else {
              // ĐÃ CÓ TÀI KHOẢN -> Lấy trạng thái duyệt và data
              setIsApproved(docSnap.data().isApproved || false);
              setUserData(docSnap.data());
            }
            setUser(currentUser);
            setLoading(false); // Bắt buộc chờ có data mới tắt Loading
          }, (err) => {
            console.error("Lỗi kết nối Firestore (Có thể do Adblock):", err);
            // Vẫn phải tắt loading để không bị treo màn hình đen mãi mãi
            setUser(currentUser);
            setIsApproved(false);
            setLoading(false);
          });
        } else {
          setUser(null);
          setIsApproved(false);
          setUserData(null);
          setLoading(false);
          if (unsubsDoc) {
            unsubsDoc();
            unsubsDoc = null;
          }
        }
      } catch (error) {
        console.error("Firebase/Auth Error:", error);
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      if (unsubsDoc) unsubsDoc();
    };
  }, []);

  const { showToast } = useNotification();

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === 'auth/popup-blocked' || (error.message && error.message.includes('popup'))) {
        showToast("Trình chặn quảng cáo đã chặn cửa sổ! Đang dùng chế độ chuyển hướng...", "warning");
        setTimeout(() => {
          signInWithRedirect(auth, googleProvider).catch(err => {
            console.error("Lỗi chuyển hướng:", err);
            showToast("Vui lòng TẮT TRÌNH CHẶN QUẢNG CÁO (Adblock/Brave Shields) để đăng nhập!", "error");
          });
        }, 1500);
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // Người dùng tự đóng popup, không làm gì cả
      } else {
        console.error("Lỗi đăng nhập:", error);
        showToast("Lỗi đăng nhập: Vui lòng tắt Adblock và thử lại!", "error");
      }
    }
  };

  const logout = () => signOut(auth);

  const getRankInfo = (seconds = 0) => {
    const hours = Math.floor(seconds / 3600);
    if (hours < 5) return { name: "Xem Dạo", color: "text-zinc-400", border: "border-zinc-500", glow: "shadow-[0_0_10px_rgba(161,161,170,0.5)]", icon: "👀" };
    if (hours < 30) return { name: "Mọt Tập Sự", color: "text-emerald-400", border: "border-emerald-500", glow: "shadow-[0_0_15px_rgba(52,211,153,0.6)]", icon: "🌱" };
    if (hours < 100) return { name: "Thợ Săn Phim", color: "text-blue-400", border: "border-blue-500", glow: "shadow-[0_0_15px_rgba(96,165,250,0.6)]", icon: "🎯" };
    if (hours < 300) return { name: "Mọt Đẳng Cấp", color: "text-purple-400", border: "border-purple-500", glow: "shadow-[0_0_20px_rgba(192,132,252,0.7)]", icon: "⭐" };
    if (hours < 600) return { name: "CG Bình Luận", color: "text-pink-400", border: "border-pink-500", glow: "shadow-[0_0_25px_rgba(244,114,182,0.8)]", icon: "💬" };
    if (hours < 1200) return { name: "Trùm Điện Ảnh", color: "text-yellow-400", border: "border-yellow-500", glow: "shadow-[0_0_30px_rgba(250,204,21,0.9)]", icon: "👑" };
    return { name: "Tinh Anh Cinephile", color: "text-red-500", border: "border-red-600", glow: "shadow-[0_0_40px_rgba(239,68,68,1)] animate-pulse", icon: "🔥" };
  };

  return (
    <AuthContext.Provider value={{ user, isApproved, userData, getRankInfo, loginWithGoogle, logout }}>
      {!loading ? children : (
        <div className="h-screen bg-black flex items-center justify-center">
          <LoadingLogo className="w-14 h-14" />
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);