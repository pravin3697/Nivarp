import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA-g5aa4ZnQoGukeBJssDBmWSVsKIRMKLE",
  authDomain: "nivarp-5698.firebaseapp.com",
  projectId: "nivarp-5698",
  storageBucket: "nivarp-5698.firebasestorage.app",
  messagingSenderId: "118817880310",
  appId: "1:118817880310:web:6535fb8ba2cf75501614d7"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom parameters to ensure account selection dialog always shows
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn("User closed login popup");
      return null;
    }
    console.error("Firebase Login Error:", error);
    return null;
  }
}

export async function logoutUser() {
  await signOut(auth);
}