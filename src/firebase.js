import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// =============================================
// REPLACE THIS WITH YOUR FIREBASE CONFIG
// Go to: Firebase Console > Project Settings > Your Apps
// =============================================
const firebaseConfig = {
  apiKey: "AIzaSyDNtC_wOmyd3w3iixYQBPFBBHELOz1bD7U",
  authDomain: "mutito-hill-honey.firebaseapp.com",
  projectId: "mutito-hill-honey",
  storageBucket: "mutito-hill-honey.firebasestorage.app",
  messagingSenderId: "205174129358",
  appId: "1:205174129358:web:3393009b1c39ab9cb0469f",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
