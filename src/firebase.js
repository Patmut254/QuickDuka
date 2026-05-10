import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

// New Firestore initialization with offline support
export const db = initializeFirestore(app, {
  cache: persistentLocalCache({
    // handles multiple tabs safely
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);

// Secondary app — used ONLY when creating staff accounts so the owner's
// auth session is never interrupted (createUserWithEmailAndPassword would
// otherwise switch the current user to the newly created one).
let _secondaryApp = null;
export function getSecondaryApp() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, "secondary");
  }
  return _secondaryApp;
}
