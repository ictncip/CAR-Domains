import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDrl_4XKtUXAVlKIlq0oRFsQ-bW2hG4v5Q",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "car-domains-7b6d5.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "car-domains-7b6d5",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "car-domains-7b6d5.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "336290256067",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:336290256067:web:1b304eb570cc3661b6be76",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
