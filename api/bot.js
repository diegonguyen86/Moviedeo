import admin, { verifyActionSignature } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  const { uid, action, sig } = req.query;

  if (!uid || !action) {
    return res.status(400).send('<h1>⚠️ Lỗi: Thiếu thông tin UID hoặc Hành động!</h1>');
  }

  if (action !== 'approve' && action !== 'decline') {
    return res.status(400).send('<h1>⚠️ Hành động không hợp lệ!</h1>');
  }

  // Link chỉ hợp lệ khi có chữ ký do server tạo ra (gửi qua Telegram).
  // Trước đây ai biết UID của mình cũng tự gọi /api/bot?action=approve để tự duyệt được.
  if (!verifyActionSignature(uid, action, sig)) {
    return res.status(403).send('<h1>⛔ Link không hợp lệ hoặc đã bị chỉnh sửa.</h1>');
  }

  if (!admin.apps.length) {
    return res.status(500).send('<h1>🔥 Firebase Admin chưa được cấu hình trên server.</h1>');
  }

  try {
    const db = admin.firestore();
    if (action === 'approve') {
      await db.collection('users').doc(uid).update({ isApproved: true });
      return res.status(200).send('<h1>✅ Đã duyệt thành công! Ông giáo có thể tắt tab này và báo nó vào xem phim đi.</h1>');
    }
    // action === 'decline': xoá user khỏi database
    await db.collection('users').doc(uid).delete();
    return res.status(200).send('<h1>❌ Đã đuổi cổ nó! Cút ngay không tiễn!</h1>');
  } catch (error) {
    return res.status(500).send('<h1>🔥 Lỗi server rồi.</h1>');
  }
}
