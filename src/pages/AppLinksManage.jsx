import { useState, useEffect } from "react";
import { db, storage } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useNotification } from "../context/NotificationContext";

export default function AppLinksManage() {
  const { showToast } = useNotification();
  const [links, setLinks] = useState({
    android: "",
    androidVersion: "",
    ios: "",
    iosVersion: "",
    tv: "",
    tvVersion: ""
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ android: 0, ios: 0, tv: 0 });

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

  const handleDeleteOldFile = async (oldUrl) => {
    if (!oldUrl || !oldUrl.includes("firebasestorage.googleapis.com")) return;
    try {
      const decodedUrl = decodeURIComponent(oldUrl);
      const urlPath = decodedUrl.split('/o/')[1].split('?alt=media')[0];
      const oldRef = ref(storage, urlPath);
      await deleteObject(oldRef);
      console.log("Đã xóa file cũ:", urlPath);
    } catch (error) {
      console.log("Lỗi xóa file cũ (có thể file không tồn tại):", error);
    }
  };

  const handleFileUpload = async (e, platform) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `apps/${platform}-${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(prev => ({ ...prev, [platform]: progress }));
      },
      (error) => {
        showToast(`Lỗi upload ${platform}: ` + error.message, "error");
        setUploadProgress(prev => ({ ...prev, [platform]: 0 }));
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        if (links[platform]) {
          await handleDeleteOldFile(links[platform]);
        }

        setLinks(prev => ({ ...prev, [platform]: downloadURL }));
        setUploadProgress(prev => ({ ...prev, [platform]: 0 }));
        showToast(`Tải lên file cho ${platform.toUpperCase()} thành công!`, "success");
      }
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "admin_settings", "app_links");
      await setDoc(docRef, links, { merge: true });
      showToast("Lưu đường dẫn tải App thành công!", "success");
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      showToast("Lỗi: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const renderPlatformSection = (platform, title, accept) => (
    <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
      <h3 className="text-xl font-bold text-white mb-4 capitalize">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-zinc-400 mb-2">Phiên bản (Version)</label>
          <input 
            type="text" 
            value={links[`${platform}Version`] || ""}
            onChange={(e) => setLinks({...links, [`${platform}Version`]: e.target.value})}
            placeholder="VD: 1.2.18"
            className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-zinc-400 mb-2">Tải file lên (Tự động xóa file cũ)</label>
          <div className="relative w-full h-[52px]">
            <input
              type="file"
              accept={accept}
              onChange={(e) => handleFileUpload(e, platform)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="absolute inset-0 bg-yellow-500/10 border border-yellow-500/50 rounded-xl flex items-center justify-center text-yellow-500 font-bold">
              {uploadProgress[platform] > 0 
                ? `Đang tải: ${Math.round(uploadProgress[platform])}%` 
                : "CHỌN FILE ĐỂ TẢI LÊN"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-zinc-400 mb-2">Hoặc nhập Link tải trực tiếp</label>
        <input 
          type="text" 
          value={links[platform] || ""}
          onChange={(e) => setLinks({...links, [platform]: e.target.value})}
          placeholder="VD: https://firebasestorage.googleapis.com/..."
          className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500 transition-colors text-sm"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-28 pb-32">
      <h1 className="text-3xl font-black mb-6 uppercase text-yellow-500">Trung Tâm Phân Phối App</h1>
      
      <div className="bg-white/10 p-6 rounded-2xl max-w-4xl">
        <p className="text-zinc-400 mb-6 leading-relaxed">
          Quản lý đường dẫn tải file cài đặt (.apk, .ipa) và phiên bản hiện tại của ứng dụng. 
          Thiết bị người dùng sẽ tự động kiểm tra phiên bản tại đây để yêu cầu ép cập nhật.
        </p>

        {renderPlatformSection("android", "📱 Mobile Android", ".apk")}
        {renderPlatformSection("ios", "🍏 Mobile iOS (Sideload / Testflight)", ".ipa")}
        {renderPlatformSection("tv", "📺 Smart TV Android", ".apk")}

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="mt-6 w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black px-6 py-4 rounded-xl hover:scale-[1.01] transition-transform disabled:opacity-50"
        >
          {isSaving ? "Đang lưu..." : "💾 LƯU TẤT CẢ THAY ĐỔI"}
        </button>
      </div>
    </div>
  );
}
