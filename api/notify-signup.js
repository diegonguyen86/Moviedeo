// Gửi thông báo "có khách mới đăng ký" sang Telegram từ phía SERVER.
// Trước đây Bot Token nằm trong biến VITE_ nên bị đóng gói lộ ra trình duyệt cho bất kỳ ai xem.
import admin, { getUidFromRequest, signAction, escapeHtml } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await getUidFromRequest(req);
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'Telegram chưa được cấu hình' });
  }

  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const data = snap.data();
    // Chỉ gửi 1 lần cho mỗi tài khoản, kể cả khi client gọi lại nhiều lần
    if (data.isApproved || data.adminNotifiedAt) {
      return res.status(200).json({ success: true, skipped: true });
    }

    const name = data.displayName || (data.email || '').split('@')[0] || 'Ẩn danh';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${req.headers.host}`;
    const link = (action) =>
      `${baseUrl}/api/bot?action=${action}&uid=${encodeURIComponent(uid)}&sig=${signAction(uid, action)}`;

    const messageText =
      `<b>🍿 CÓ KHÁCH MỚI ĐĂNG KÝ!</b>\n\n` +
      `👤 <b>Tên:</b> ${escapeHtml(name)}\n` +
      `📧 <b>Email:</b> ${escapeHtml(data.email || '')}\n\n` +
      `<i>Ông giáo Khôi bấm nút dưới đây để xử lý nhé:</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: messageText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ DUYỆT NGAY', url: link('approve') },
            { text: '❌ CÚT', url: link('decline') },
          ]],
        },
      }),
    });

    if (!tgRes.ok) {
      return res.status(502).json({ error: 'Telegram API error' });
    }

    await userRef.update({ adminNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('notify-signup error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
