// ===== Firebase से जोड़ना =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0RSPrTASfJQLBHHr1hpH0IFe-Qlas_GA",
  authDomain: "mohalla-bazaar-41459.firebaseapp.com",
  projectId: "mohalla-bazaar-41459",
  storageBucket: "mohalla-bazaar-41459.firebasestorage.app",
  messagingSenderId: "902086189654",
  appId: "1:902086189654:web:6098b6b71a22a28beb51f7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== इस फोन की "सेलर आईडी" — यह पहचानती है कि यह डेटा किसका है =====
function getMySellerId() {
  let id = localStorage.getItem("myDeviceSellerId");
  if (!id) {
    id = "seller_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    localStorage.setItem("myDeviceSellerId", id);
  }
  return id;
}

// बाकी फाइलों में इस्तेमाल करने के लिए एक्सपोर्ट करना
window.firebaseDB = db;
window.firebaseTools = { collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy };
window.getMySellerId = getMySellerId;
