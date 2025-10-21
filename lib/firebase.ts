import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Auto sign-in anonymously when the app loads
let authInitialized = false;

export const ensureAuth = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser.uid);
      return;
    }

    if (!authInitialized) {
      authInitialized = true;
      
      onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('Authenticated with UID:', user.uid);
          resolve(user.uid);
        }
      });

      signInAnonymously(auth)
        .catch((error) => {
          console.error('Anonymous auth failed:', error);
          reject(error);
        });
    } else {
      // Already initializing, wait for state change
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve(user.uid);
        }
      });
    }
  });
};
