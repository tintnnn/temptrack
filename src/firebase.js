import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBvbXkgIj02qhPPbkA4uo6kWa0NLLJmIB0",
  authDomain: "testiot-8abfb.firebaseapp.com",
  projectId: "testiot-8abfb",
  storageBucket: "testiot-8abfb.firebasestorage.app",
  messagingSenderId: "627033184505",
  appId: "1:627033184505:web:6dd3691194fa57f0d96a28",
  measurementId: "G-5KXYHM609F",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    "https://testiot-8abfb-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const stationRef = ref(database, "dht_station");
export const historyRootRef = ref(database, "dht_history");
export const historyRef = (timestamp) => ref(database, `dht_history/${timestamp}`);
export {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  set,
};
