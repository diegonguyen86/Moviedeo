import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "../firebase"; 
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"; 
import { doc, getDoc, setDoc } from "firebase/firestore"; 

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        if (currentUser) {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
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
            // Gửi thông báo cho Admin (Chỉ gửi 1 lần duy nhất lúc này)
            await notifyAdmin(currentUser.displayName, currentUser.email, currentUser.uid);
          } else {
            // ĐÃ CÓ TÀI KHOẢN -> Chỉ lấy trạng thái duyệt
            setIsApproved(userDoc.data().isApproved || false);
          }
          setUser(currentUser);
        } else {
          setUser(null);
          setIsApproved(false);
        }
      } catch (error) {
        console.error("Firebase/Auth Error:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isApproved, loginWithGoogle, logout }}>
      {!loading ? children : (
        <div className="h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);