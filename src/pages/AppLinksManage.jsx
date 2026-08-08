import { useState, useEffect } from "react";
import { useNotification } from "../context/NotificationContext";

export default function AppLinksManage() {
  const { showToast } = useNotification();
  const [links, setLinks] = useState({
    android: { version: "", url: "" },
    tv: { version: "", url: "" },
    ios: { version: "", url: "" }
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLinks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/releases");
      if (!res.ok) throw new Error("Không thể lấy dữ liệu từ Github");
      const data = await res.json();
      setLinks({
        android: data.android || { version: "", url: "" },
        tv: data.tv || { version: "", url: "" },
        ios: data.ios || { version: "", url: "" }
      });
    } catch (error) {
      console.error("Lỗi khi tải link app từ API:", error);
      showToast("Lỗi đồng bộ Github: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const renderPlatformSection = (platform, title) => (
    <div className="bg-white/5 p-5 rounded-xl border border-white/10 mb-4 flex flex-col gap-3">
      <h3 className="text-xl font-bold text-white mb-2 capitalize">{title}</h3>
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 bg-black/50 p-4 rounded-xl border border-white/10">
          <p className="text-sm text-zinc-400 font-bold mb-1">Phiên bản hiện tại trên Github</p>
          <p className="text-yellow-500 font-black text-xl">
            {links[platform]?.version ? `v${links[platform].version}` : "Chưa có bản phát hành"}
          </p>
        </div>
        
        <div className="flex-[2] bg-black/50 p-4 rounded-xl border border-white/10 flex flex-col justify-center overflow-hidden">
          <p className="text-sm text-zinc-400 font-bold mb-1">Link tải tự động</p>
          <a 
            href={links[platform]?.url || "#"} 
            target="_blank" 
            rel="noreferrer"
            className={`text-sm break-all ${links[platform]?.url ? 'text-blue-400 hover:underline' : 'text-zinc-600'}`}
          >
            {links[platform]?.url || "Chưa có file nào đính kèm trên Github"}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-28 pb-32">
      <h1 className="text-3xl font-black mb-6 uppercase text-yellow-500">Trung Tâm Phân Phối App</h1>
      
      <div className="bg-white/10 p-6 rounded-2xl max-w-4xl">
        <p className="text-zinc-300 mb-6 leading-relaxed bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
          ℹ️ <strong>Hệ thống tự động hóa Github:</strong><br />
          Các đường dẫn tải file cài đặt (.apk, .ipa) và phiên bản hiện tại được hệ thống <strong>tự động đồng bộ 100%</strong> từ Github Releases. 
          Bạn không cần (và không thể) chỉnh sửa thủ công tại đây. Chỉ cần up file lên Github, mọi thiết bị người dùng sẽ tự động nhận diện và ép cập nhật!
        </p>

        {isLoading ? (
          <div className="py-20 text-center text-yellow-500 animate-pulse font-bold text-xl">
            Đang đồng bộ dữ liệu từ Github...
          </div>
        ) : (
          <>
            {renderPlatformSection("android", "📱 Mobile Android")}
            {renderPlatformSection("ios", "🍏 Mobile iOS (IPA Sideload)")}
            {renderPlatformSection("tv", "📺 Smart TV Android")}

            <button 
              onClick={fetchLinks}
              disabled={isLoading}
              className="mt-6 w-full bg-zinc-800 text-white font-bold px-6 py-4 rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">sync</span>
              LÀM MỚI DỮ LIỆU
            </button>
          </>
        )}
      </div>
    </div>
  );
}
