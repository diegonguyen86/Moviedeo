// File bắt đầu bằng "_" nên Vercel KHÔNG biến nó thành 1 API route.
// Dùng chung cho mọi serverless function cần Firebase Admin.
import admin from 'firebase-admin';
import crypto from 'crypto';

export const ADMIN_UID = 'qD9qHFwiucgQOj6bXHoCIuHuoWv1';

if (!admin.apps.length) {
  try {
    // Hỗ trợ cả 2 kiểu cấu hình env đang dùng trong dự án:
    // 1) FIREBASE_SERVICE_ACCOUNT = chuỗi JSON của file service account
    // 2) VITE_FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Dùng replace để Vercel không bị lỗi dấu xuống dòng của Private Key
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      });
    }
    admin.initializeApp({ credential });
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase Admin:', error);
  }
}

export default admin;

// Khoá bí mật để ký link Duyệt/Từ chối trong Telegram.
// Ưu tiên BOT_SECRET, nếu chưa cấu hình thì dùng tạm private key của service account (không bao giờ lộ ra client).
const getSigningSecret = () =>
  process.env.BOT_SECRET ||
  process.env.FIREBASE_PRIVATE_KEY ||
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  '';

export const signAction = (uid, action) =>
  crypto.createHmac('sha256', getSigningSecret()).update(`${uid}:${action}`).digest('hex');

export const verifyActionSignature = (uid, action, sig) => {
  if (!sig || typeof sig !== 'string' || !getSigningSecret()) return false;
  const expected = Buffer.from(signAction(uid, action));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

// Lấy uid từ header "Authorization: Bearer <Firebase ID token>"; trả về null nếu không hợp lệ.
export const getUidFromRequest = async (req) => {
  const header = req.headers?.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match || !admin.apps.length) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    return null;
  }
};

export const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
