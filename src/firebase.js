import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCe3Bd-bK-m6aFdtAUFnKSakNdnBqNuX6A",
  authDomain: "priest-library-app-22e8f.firebaseapp.com",
  projectId: "priest-library-app-22e8f",
  storageBucket: "priest-library-app-22e8f.firebasestorage.app",
  messagingSenderId: "1021784741300",
  appId: "1:1021784741300:web:571538930535a827e14ee1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const logInWithGoogle = () => signInWithPopup(auth, provider);
export const logOut = () => signOut(auth);
