import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Tự động cuộn lên đầu trang mỗi khi chuyển route
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant", // Dùng instant để không bị thấy giật giật khi chuyển trang
    });
  }, [pathname]);

  return null;
}
