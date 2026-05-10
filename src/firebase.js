// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCy8TIcL8ZO2dJ8UoR2NPiJhDUhR5Q8GYs",
  authDomain: "phimkhonghaylamcho.firebaseapp.com",
  projectId: "phimkhonghaylamcho",
  storageBucket: "phimkhonghaylamcho.firebasestorage.app",
  messagingSenderId: "129326493795",
  appId: "1:129326493795:web:10a0cdafcd5d1f2cb18856",
  measurementId: "G-089KXJWTQP"
};

const app = initializeApp(firebaseConfig);

// PHẢI CÓ CHỮ EXPORT Ở ĐẦU CÁC DÒNG NÀY:
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();