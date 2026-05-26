import { initializeApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAoHGXb9zSdHUFaTCTotPPaKgxKcjK6F1U",
  authDomain: "timeliney-d4005.firebaseapp.com",
  projectId: "timeliney-d4005",
  storageBucket: "timeliney-d4005.firebasestorage.app",
  messagingSenderId: "1096735575212",
  appId: "1:1096735575212:web:e4d9e0c32abe638ce52309",
  measurementId: "G-37QPX9YEWL"
};

const app = initializeApp(firebaseConfig);
// @ts-ignore - TypeScript doesn't always recognize this export in certain RN environments
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);
