// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDUMMYKEYFORLOCALDEV1234567890123",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "moviedeo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "moviedeo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "moviedeo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef123456",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-123456"
};

const app = initializeApp(firebaseConfig);

// PHẢI CÓ CHỮ EXPORT Ở ĐẦU CÁC DÒNG NÀY:
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();