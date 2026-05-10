import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, googleProvider } from "../firebase"; 
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"; 
import { doc, getDoc, setDoc } from "firebase/firestore"; 

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true);
        if (currentUser) {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Lần đầu đăng ký: Chỉ lưu Firestore, không gọi Bot nữa
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              isApproved: false,
              createdAt: new Date().toISOString()
            });
            setIsApproved(false);
          } else {
            setIsApproved(userDoc.data().isApproved || false);
          }
          setUser(currentUser);
        } else {
          setUser(null);
          setIsApproved(false);
        }
      } catch (error) {
        console.error("Firebase/Auth Error:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isApproved, loginWithGoogle, logout }}>
      {!loading ? children : (
        <div className="h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
