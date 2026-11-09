# DESIGN.md — Phim Hay Quá Trời

Ghi lại các quyết định giao diện để lần sửa sau giữ đúng một hệ. Làm theo skill `ui-ux` của evondevKit (nhánh `U`, lối "dựng luôn").

## Brief
| | | Nguồn |
|---|---|---|
| Sản phẩm | Kho phim riêng tư, miễn phí; phim lấy từ nguồn ngoài; web quản lý lịch sử xem, danh sách yêu thích, bình luận | chủ web nói |
| Cho ai | Bạn bè của chủ web, phải được duyệt mới vào | chủ web nói |
| Việc chính | 1) Xem tiếp phim đang dở · 2) Tìm và chọn phim mới · 3) Lưu phim xem sau | đọc code |
| Nền tảng | Điện thoại là chính, máy tính thứ hai | đoán |
| Điểm khác biệt | Không quảng cáo; hạng thành viên theo giờ xem; bình luận cùng bạn bè; có app TV | đọc code |

## Bộ mặt
- **Phong cách:** nền tối là chính (evon `P10`). Kính mờ chỉ ở header, thanh lọc dính đầu trang (có nội dung cuộn phía sau). Không phát sáng (glow), không chữ chuyển màu.
- **Màu nhấn duy nhất:** đỏ thương hiệu `--color-brand` `#e50914` (hover `#f6121d`). Dùng cho: nút chính (Xem ngay / Xem tiếp / Gửi), thanh tiến độ xem, chấm "đang lọc".
- **Sắc: Vivid** (evon `P17`, chủ web xin "màu sắc hơn"):
  - **Gradient nhấn** `brand #e50914 → accent-to #db2777`: chỉ cho nút chính (`.btn-primary`), thanh tiến độ trình phát, và **một khối hero mỗi màn** (`.hero-border`, vd ô "lên hạng" ở Hồ sơ).
  - **Vệt loang** `from-brand/12` ở ~288px đầu trang Kho phim và Hồ sơ.
  - **Sắc phân loại** (chỉ cho icon / chấm / thanh, không cho chữ), một loại một màu trên mọi màn:

    | Loại | Sắc | Icon |
    |---|---|---|
    | Xem tiếp / lịch sử, nhóm lọc Định dạng, "Phim đã xem" | `cat-1` xanh dương `#60a5fa` | `history`, `movie` |
    | Phim chiếu rạp, nhóm lọc Thể loại, "Giờ xem", nguồn phát | `cat-2` xanh ngọc `#2dd4bf` | `theaters`, `theater_comedy`, `schedule`, `dns` |
    | Quốc gia | `cat-3` tím `#a78bfa` | `public` |
    | Năm | `cat-4` hồng tím `#e879f9` | `calendar_month` |
  - **Hạng thành viên** (theo giờ xem): màu riêng của từng hạng ở viền avatar trên header + huy hiệu emoji góc avatar. Mốc giờ ở `RANK_STEPS` trong `src/context/AuthContext.jsx`: 2 / 10 / 30 / 70 / 150 / 300 giờ.
- **Trình phát:** icon SVG riêng (`src/components/PlayerIcons.jsx`), nét 2px bo tròn; nút hàng dưới tròn 40px icon 24px; nút Play giữa tròn kính mờ.
- **Mục đang chọn** (chip lọc, số trang, phần phim): nền sáng `bg-fg` chữ tối `text-canvas`.
- **Việc nguy hiểm** (xoá): nền đỏ mờ `bg-red-500/15 text-red-400`.
- **Bề mặt:** `canvas #0b0b0e` → `card #15151a` → `raised #1e1e25` (lớp nổi). Viền `line` (trắng 8%), `line-strong` (trắng 16%) cho ô nhập và nút viền.
- **Chữ:** 3 sắc độ `fg` / `fg-2` / `fg-3`. Một họ chữ: Inter.
- **Thang cỡ:** tên trang `xl`; tiêu đề khối `lg`; tên phim trong thẻ `sm font-medium`; tên phim ở trang chi tiết là hero `2xl → 4xl`.
- **Bo góc:** thẻ phim `rounded-lg`; nút cao 40–44px `rounded-xl`; chip `rounded-full`.
- **Đang tải:** khung chờ đúng hình (`components/Skeletons.jsx`), chờ 300ms mới hiện, đã hiện giữ ≥500ms (`hooks/useDelayedLoading.js`). Đổi lọc thì giữ danh sách cũ + thanh mảnh đỏ trên đầu.
- **Thanh cuộn:** 4px, trong suốt tới khi rê (evon `I18`). Hàng chip / băng chuyền: `.scrollbar-clean`.

Token nằm ở `src/index.css` (khối `@theme`). Đổi thương hiệu: sửa `--color-brand`, `--color-brand-hover`, `--font-sans`.

## Màn đã dựng
| Màn | Bố cục |
|---|---|
| Trang chủ | Banner phim thịnh hành (nút Xem ngay đỏ + Chi tiết) → hàng **Xem tiếp** ngay dưới banner → các hàng theo chủ đề, lướt ngang |
| Kho phim | Tên trang + số trang → thanh lọc dính đầu (tab nhóm: Định dạng / Thể loại / Quốc gia / Năm + chip) → lưới poster 3–6 cột → phân trang |
| Chi tiết phim | Ảnh nền → poster + tên + thông số + thể loại → nút chính **Xem ngay / Xem tiếp tập X** → mô tả thu gọn → danh sách tập (tập đang xem dở viền đỏ) → thông tin → bình luận |
| Trình phát | Giữ khung cũ, đổi màu theo hệ (bỏ vàng, bỏ glow), thanh tiến độ đỏ |
| Đăng nhập / đăng ký / quên mật khẩu | Một cột giữa màn (evon form.md A): logo, tiêu đề, nhãn + ô `h-12`, nút xem mật khẩu, lỗi ngay dưới form, nút Google |
| Chờ duyệt, tạo mật khẩu, đăng nhập TV | Cùng khuôn với màn đăng nhập |
| Hồ sơ | Người dùng + đăng xuất (đỏ) → 3 ô số liệu (phim đã xem, giờ xem, còn bao nhiêu giờ lên hạng) → bảng danh hiệu (mở ra khi cần) → lưới phim yêu thích |
| Popup | Chào mừng, tải app (danh sách nền tảng + phiên bản), hộp xác nhận xoá, thông báo: lớp nổi `raised` + viền `line` |
