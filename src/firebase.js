import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// REPLACE THIS WITH YOUR FIREBASE CONFIG
// Go to: Firebase Console > Project Settings > Your Apps

const firebaseConfig = {
  apiKey: "AIzaSyAyZbACvYwWxnGt2vQprG-zmu8HzVb_nj0",
  authDomain: "quickduka.firebaseapp.com",
  projectId: "quickduka",
  storageBucket: "quickduka.firebasestorage.app",
  messagingSenderId: "995653940433",
  appId: "1:995653940433:web:8f7d8e684f5e028fa301f0",
  measurementId: "G-VEN4BJPGJ5",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
