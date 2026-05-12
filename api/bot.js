const admin = require('firebase-admin');

// Khởi tạo quyền Admin Firebase để chọc vào Database
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Dùng replace để Vercel không bị lỗi dấu xuống dòng của Private Key
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Vercel dùng req.query cực kỳ ngắn gọn và dễ hiểu
  const { uid, action } = req.query;

  if (!uid || !action) {
    return res.status(400).send('<h1>⚠️ Lỗi: Thiếu thông tin UID hoặc Hành động!</h1>');
  }

  try {
    if (action === 'approve') {
      // Sửa isApproved thành true
      await db.collection('users').doc(uid).update({ isApproved: true });
      return res.status(200).send('<h1>✅ Đã duyệt thành công! Ông giáo có thể tắt tab này và báo nó vào xem phim đi.</h1>');
    } else if (action === 'decline') {
      // Xóa luôn user khỏi database
      await db.collection('users').doc(uid).delete();
      return res.status(200).send('<h1>❌ Đã đuổi cổ nó! Cút ngay không tiễn!</h1>');
    }
  } catch (error) {
    return res.status(500).send('<h1>🔥 Lỗi server rồi: ' + error.message + '</h1>');
  }
}