// Firebase configuration
// Uses environment variables with fallbacks for development
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCKnUHdSBTaLqqwhKrvYUd_he_afE4eUaU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "computer-spy-ai.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "computer-spy-ai",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "computer-spy-ai.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "253176543219",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:253176543219:web:6db0b7f179593c39a88486"
};
