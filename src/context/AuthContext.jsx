import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "../firebase"; 
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"; 
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import LoadingLogo from "../components/LoadingLogo";

const AuthContext = createContext();

// Mốc giờ xem của các hạng: 2h, 10h, 30h, 70h, 150h, 300h (dùng chung cho getRankInfo và trang Hồ sơ)
export const RANK_STEPS = [2, 10, 30, 70, 150, 300];

// ---------------------------------------------------------------------------
// MỞ WEB TỨC THÌ: nhớ trạng thái đăng nhập lần trước vào máy.
// Trước đây mỗi lần mở web phải chờ Firebase xác minh phiên (0.8-7s) + đọc hồ sơ (≈2s) nối tiếp nhau
// rồi mới thấy nội dung. Giờ hiện giao diện ngay theo trạng thái đã nhớ, Firebase xác minh ngầm phía sau
// (nếu phiên hết hạn / bị huỷ duyệt thì tự chuyển về màn đăng nhập / chờ duyệt).
// An toàn: dữ liệu thật vẫn do Firestore Rules + server kiểm tra, bản nhớ này chỉ để vẽ giao diện sớm.
// ---------------------------------------------------------------------------
const SESSION_KEY = "phq_session_v1";

const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSession = (session) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* bị chặn bộ nhớ: bỏ qua */ }
};

// User "tạm" dựng từ bản nhớ, có đủ các trường giao diện cần (uid, email, ảnh, tên)
const toCachedUser = (s) => s && ({
  uid: s.uid,
  email: s.email,
  displayName: s.displayName,
  photoURL: s.photoURL,
  providerData: [],
  isCached: true,
  getIdToken: (...args) => auth.currentUser
    ? auth.currentUser.getIdToken(...args)
    : Promise.reject(new Error("Phiên đăng nhập đang được xác minh, thử lại sau giây lát")),
});

export function AuthProvider({ children }) {
  const [initialSession] = useState(readSession);
  const [user, setUser] = useState(() => toCachedUser(initialSession));
  const [isApproved, setIsApproved] = useState(!!initialSession?.isApproved);
  const [userData, setUserData] = useState(initialSession?.userData || null);
  const [loading, setLoading] = useState(!initialSession);
  const [hasPassword, setHasPassword] = useState(!!initialSession?.hasPassword);

  // --- 🤖 BÁO ADMIN QUA TELEGRAM ---
  // Gửi qua serverless function /api/notify-signup để Bot Token không bị lộ ra trình duyệt
  // và link Duyệt/Từ chối được ký bảo mật (không ai tự duyệt mình được).
  const notifyAdmin = async (currentUser) => {
    try {
      const idToken = await currentUser.getIdToken();
      await fetch("/api/notify-signup", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch (error) {
      console.error("❌ Lỗi Bot:", error);
    }
  };

  useEffect(() => {
    let unsubsDoc = null;
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        try {
          // Huỷ listener của tài khoản trước (trường hợp đổi tài khoản)
          if (unsubsDoc) {
            unsubsDoc();
            unsubsDoc = null;
          }
          if (currentUser) {
            const cached = readSession();
            // Chỉ hiện màn loading khi chưa có bản nhớ của ĐÚNG tài khoản này (vd: lần đầu đăng nhập)
            if (!cached || cached.uid !== currentUser.uid) setLoading(true);

            // Kiểm tra xem người dùng có Provider Password hay không
            const hasPass = currentUser.providerData.some(p => p.providerId === 'password');
            setHasPassword(hasPass);
            setUser(currentUser);

            const userDocRef = doc(db, "users", currentUser.uid);
            let creating = false;
            let notified = false;

            // Lắng nghe hồ sơ real-time NGAY (bỏ bước getDoc riêng -> bớt 1 lượt chờ mạng ≈ 2 giây)
            unsubsDoc = onSnapshot(userDocRef, async (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setIsApproved(data.isApproved || false);
                setUserData(data);
                writeSession({
                  uid: currentUser.uid,
                  email: currentUser.email,
                  displayName: currentUser.displayName,
                  photoURL: currentUser.photoURL,
                  hasPassword: hasPass,
                  isApproved: !!data.isApproved,
                  userData: { totalWatchSeconds: data.totalWatchSeconds || 0, watchedCount: data.watchedCount || 0 },
                });
                if (!data.isApproved && !data.adminNotifiedAt && !notified) {
                  // Lần trước gửi Telegram thất bại -> thử lại (server tự chống gửi trùng)
                  notified = true;
                  notifyAdmin(currentUser);
                }
                setLoading(false);
              } else if (!docSnap.metadata.fromCache && !creating) {
                // TẠO MỚI KHI LẦN ĐẦU ĐĂNG NHẬP (snapshot kế tiếp sẽ chứa hồ sơ vừa tạo)
                creating = true;
                setIsApproved(false);
                setUserData(null);
                try {
                  await setDoc(userDocRef, {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email?.split('@')[0] || 'U')}&background=random`,
                    isApproved: false,
                    createdAt: new Date().toISOString()
                  });
                  notified = true;
                  await notifyAdmin(currentUser);
                } catch (e) {
                  console.error("Lỗi khởi tạo user:", e);
                  setLoading(false);
                }
              }
            }, (err) => {
              console.error("Lỗi kết nối Firestore:", err);
              // Vẫn phải tắt loading để không bị treo màn hình mãi mãi
              setIsApproved(false);
              setLoading(false);
            });
          } else {
            writeSession(null);
            setUser(null);
            setIsApproved(false);
            setUserData(null);
            setHasPassword(false);
            setLoading(false);
          }
        } catch (error) {
          console.error("Firebase/Auth Error:", error);
          setLoading(false);
        }
      }, (err) => {
        console.warn("Auth error:", err);
        setLoading(false);
      });
    } catch (e) {
      console.warn("Lỗi khởi tạo Auth listener:", e);
      setLoading(false);
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (unsubsDoc) unsubsDoc();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      return { success: true };
    } catch (error) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // Người dùng tự đóng popup
        return { success: false, reason: 'cancelled' };
      } else {
        // Mọi lỗi còn lại (popup-blocked, network-request-failed do Brave Shields chặn cookie, internal-error do Adguard)
        // Đều được quy về nguyên nhân do Trình chặn quảng cáo phá bĩnh.
        console.error("Lỗi đăng nhập bị chặn:", error);
        return { success: false, reason: 'blocked' };
      }
    }
  };

  const logout = () => {
    writeSession(null);
    return signOut(auth);
  };

  // Mốc giờ xem để lên hạng (RANK_STEPS). Trước đây 5/30/100/300/600/1200 giờ: hạng cao gần như
  // không ai đạt được. Giờ khớp nhịp xem thật hơn: 1 phim lẻ ~2 giờ, 1 bộ phim ~10–20 giờ.
  const getRankInfo = (seconds = 0) => {
    const hours = Math.floor(seconds / 3600);
    const [r1, r2, r3, r4, r5, r6] = RANK_STEPS;
    if (hours < r1) return { name: "Xem Dạo", color: "text-zinc-400", border: "border-zinc-500", glow: "shadow-[0_0_10px_rgba(161,161,170,0.5)]", icon: "👀" };
    if (hours < r2) return { name: "Mọt Tập Sự", color: "text-emerald-400", border: "border-emerald-500", glow: "shadow-[0_0_15px_rgba(52,211,153,0.6)]", icon: "🌱" };
    if (hours < r3) return { name: "Thợ Săn Phim", color: "text-blue-400", border: "border-blue-500", glow: "shadow-[0_0_15px_rgba(96,165,250,0.6)]", icon: "🎯" };
    if (hours < r4) return { name: "Mọt Đẳng Cấp", color: "text-purple-400", border: "border-purple-500", glow: "shadow-[0_0_20px_rgba(192,132,252,0.7)]", icon: "⭐" };
    if (hours < r5) return { name: "CG Bình Luận", color: "text-pink-400", border: "border-pink-500", glow: "shadow-[0_0_25px_rgba(244,114,182,0.8)]", icon: "💬" };
    if (hours < r6) return { name: "Trùm Điện Ảnh", color: "text-yellow-400", border: "border-yellow-500", glow: "shadow-[0_0_30px_rgba(250,204,21,0.9)]", icon: "👑" };
    return { name: "Tinh Anh Cinephile", color: "text-red-500", border: "border-red-600", glow: "shadow-[0_0_40px_rgba(239,68,68,1)] animate-pulse", icon: "🔥" };
  };

  return (
    <AuthContext.Provider value={{ user, isApproved, userData, getRankInfo, loginWithGoogle, logout, hasPassword }}>
      {!loading ? children : (
        <div className="h-screen bg-black flex items-center justify-center">
          <LoadingLogo className="w-14 h-14" />
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);