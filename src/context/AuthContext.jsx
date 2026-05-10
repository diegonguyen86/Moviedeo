import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "../firebase"; 
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"; 
import { doc, getDoc, setDoc } from "firebase/firestore"; 

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- 🤖 SOURCE CON BOT: GỬI THÔNG BÁO TELEGRAM (ĐÃ FIX LỖI SYNTAX) ---
  const notifyAdmin = async (name, email) => {
    // Gọi biến từ Environment Variables (Vercel/ .env)
    const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;
    
    const baseUrl = window.location.origin;
    const adminUrl = `${baseUrl}/#/admin-secret`; 
    
    const messageText = `<b>🍿 CÓ KHÁCH MỚI ĐĂNG KÝ!</b>\n\n` +
                        `👤 <b>Tên:</b> ${name}\n` +
                        `📧 <b>Email:</b> ${email}\n\n` +
                        `<i>Ông giáo Khôi vào duyệt cho họ nhé!</i>`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🚀 MỞ TRANG DUYỆT NGAY", url: adminUrl }]
            ]
          }
        }),
      });

      const result = await response.json();
      if (result.ok) {
        console.log("✅ Bot đã báo về Telegram thành công!");
      } else {
        console.error("❌ Bot báo lỗi:", result.description);
      }
    } catch (error) {
      console.error("❌ Lỗi mạng khi gọi Bot Telegram:", error);
    }
  }; // Dấu đóng ngoặc chuẩn ở đây!

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        if (currentUser) {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // 1. Lần đầu đăng ký: Lưu vào Firestore
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              isApproved: false,
              createdAt: new Date().toISOString()
            });
            setIsApproved(false);
            
            // 2. KÍCH HOẠT BOT: Gửi tin nhắn ngay lập tức
            await notifyAdmin(currentUser.displayName, currentUser.email);
            
          } else {
            // Người cũ: Lấy trạng thái duyệt
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
