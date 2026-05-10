import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function AdminSecret() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const { user } = useAuth();

  // CHỈ EMAIL NÀY MỚI VÀO ĐƯỢC (Sửa thành email của Khôi nhé)
  const ADMIN_EMAIL = "khoinguyenduy37@gmail.com"; 

  if (user?.email !== ADMIN_EMAIL) {
    return <div className="h-screen bg-black text-red-500 flex items-center justify-center font-bold">CÚT! KHÔNG CÓ QUYỀN VÀO ĐÂY.</div>;
  }

  useEffect(() => {
    const q = query(collection(db, "users"), where("isApproved", "==", false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id) => {
    try {
      await updateDoc(doc(db, "users", id), { isApproved: true });
      alert("Đã duyệt xong cho ông giáo này!");
    } catch (e) { alert("Lỗi rồi!"); }
  };

  return (
    <div className="pt-32 px-6 max-w-2xl mx-auto text-white">
      <h2 className="text-3xl font-black mb-8 text-primary">DANH SÁCH CHỜ DUYỆT</h2>
      <div className="space-y-4">
        {pendingUsers.map(u => (
          <div key={u.id} className="bg-zinc-900 p-6 rounded-2xl flex justify-between items-center border border-white/5">
            <div>
              <p className="font-bold">{u.displayName}</p>
              <p className="text-zinc-500 text-sm">{u.email}</p>
            </div>
            <button onClick={() => handleApprove(u.id)} className="bg-primary px-6 py-2 rounded-xl font-bold">DUYỆT</button>
          </div>
        ))}
        {pendingUsers.length === 0 && <p className="text-zinc-600">Sạch bóng quân thù, không còn ai chờ duyệt.</p>}
      </div>
    </div>
  );
}