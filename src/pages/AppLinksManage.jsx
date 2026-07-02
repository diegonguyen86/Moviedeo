import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNotification } from "../context/NotificationContext";

export default function AppLinksManage() {
  const { showToast } = useNotification();
  const [links, setLinks] = useState({
    ios: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const docRef = doc(db, "admin_settings", "app_links");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLinks(docSnap.data());
        }
      } catch (error) {
        console.error("Lỗi khi tải link app:", error);
      }
    };
    fetchLinks();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "admin_settings", "app_links");
      // Dùng merge: true để tránh lỗi ghi đè undefined
      await setDoc(docRef, links, { merge: true });
      showToast("Lưu đường dẫn tải App thành công!", "success");
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      // Hiển thị lỗi chi tiết ra màn hình
      showToast("Lỗi: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-28">
      <h1 className="text-3xl font-black mb-6 uppercase text-yellow-500">Quản lý Link Tải App</h1>
      
      <div className="bg-white/10 p-6 rounded-2xl max-w-2xl">
        <div className="flex flex-col gap-6">
          
          <p className="text-zinc-500 mb-6 leading-relaxed">
            * Các đường dẫn tải app cho Android và Smart TV đã được tự động hóa thông qua Github Releases. 
            Bạn không cần cấu hình tại đây nữa. Khu vực này chỉ dành cho Link tải iOS (IPA hoặc Testflight).
          </p>

          {/* iOS Link */}
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-2">Link tải iOS (IPA / Testflight)</label>
            <input 
              type="text" 
              value={links.ios || ""}
              onChange={(e) => setLinks({...links, ios: e.target.value})}
              placeholder="VD: https://testflight.apple.com/join/..."
              className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>

          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="mt-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black px-6 py-4 rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            {isLoading ? "Đang lưu..." : "💾 Lưu Thay Đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
