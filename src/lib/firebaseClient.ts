import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA-g5aa4ZNQoGukeBJssDBmMWSVSKIRMKLE",
  authDomain: "nivarp-5698.firebaseapp.com",
  projectId: "nivarp-5698",
  storageBucket: "nivarp-5698.firebasestorage.app",
  messagingSenderId: "118817880310",
  appId: "1:118817880310:web:6535fb8ba2cf75501614d7"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const storage = getStorage(app);