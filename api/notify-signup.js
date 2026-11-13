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

    // CHỐNG SPAM: cấu hình Firebase là công khai -> ai cũng viết được script tạo tài khoản hàng loạt,
    // mỗi tài khoản lại khiến bot nhắn Telegram. Giới hạn toàn hệ thống: tối đa 8 tin / giờ.
    // Vượt mức thì chỉ gửi 1 tin cảnh báo cho cả giờ đó; tài khoản bị bỏ qua chưa được đánh dấu
    // adminNotifiedAt nên giờ sau (khi người đó mở web lại) vẫn được báo bình thường.
    const LIMIT_PER_HOUR = 8;
    const hourKey = new Date().toISOString().slice(0, 13); // vd "2026-11-13T10"
    const rateRef = db.collection('admin_meta').doc('signup_notify');
    const rate = await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const cur = snap.exists && snap.data().hour === hourKey ? snap.data() : { hour: hourKey, count: 0, warned: false };
      const next = { ...cur, count: cur.count + 1 };
      const overLimit = cur.count >= LIMIT_PER_HOUR;
      const sendWarning = overLimit && !cur.warned;
      if (sendWarning) next.warned = true;
      tx.set(rateRef, next);
      return { overLimit, sendWarning, count: next.count };
    });
    if (rate.overLimit) {
      if (rate.sendWarning) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            parse_mode: 'HTML',
            text: `<b>⚠️ ĐĂNG KÝ BẤT THƯỜNG</b>

Đã có hơn ${LIMIT_PER_HOUR} tài khoản mới trong 1 giờ. ` +
              `Tạm ngưng báo từng người tới hết giờ này (có thể là spam). Ai thật sự đăng ký sẽ được báo lại sau.`,
          }),
        }).catch(() => {});
      }
      return res.status(429).json({ error: 'Too many signups, try later' });
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
