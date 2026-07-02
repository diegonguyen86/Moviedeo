const admin = require('firebase-admin');

// Khởi tạo Firebase Admin SDK nếu chưa có
if (!admin.apps.length) {
  try {
    // Vercel Environment Variable: FIREBASE_SERVICE_ACCOUNT
    // Đây phải là chuỗi JSON stringify của file Service Account
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Lỗi khởi tạo Firebase Admin:', error);
  }
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, idToken } = req.body;

    if (!code || !idToken) {
      return res.status(400).json({ error: 'Missing code or idToken' });
    }

    if (!admin.apps.length) {
       return res.status(500).json({ error: 'Firebase Admin not initialized. Please set FIREBASE_SERVICE_ACCOUNT in Vercel env.' });
    }

    // 1. Xác thực idToken được gửi lên từ client (điện thoại)
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Kiểm tra xem session code có tồn tại không
    const db = admin.firestore();
    const sessionRef = db.collection('tv_auth_sessions').doc(code.toUpperCase());
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Mã đăng nhập không tồn tại hoặc đã hết hạn.' });
    }

    if (sessionDoc.data().status !== 'pending') {
      return res.status(400).json({ error: 'Mã này đã được sử dụng.' });
    }

    // 3. Tạo Custom Token cho uid này
    const customToken = await admin.auth().createCustomToken(uid);

    // 4. Lưu Custom Token vào session để TV App đọc
    await sessionRef.update({
      status: 'approved',
      customToken: customToken,
      uid: uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, message: 'Đăng nhập TV thành công!' });

  } catch (error) {
    console.error('TV Auth Error:', error);
    return res.status(500).json({ error: 'Lỗi xác thực: ' + error.message });
  }
}
