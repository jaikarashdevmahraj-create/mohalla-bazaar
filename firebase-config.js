import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
  arrayUnion,
  arrayRemove,
  onSnapshot,
  limit,
  startAfter,
  documentId,
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
const auth = getAuth(app);

function getMySellerId() {
  let id = localStorage.getItem("myDeviceSellerId");
  if (!id) {
    id = "seller_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    localStorage.setItem("myDeviceSellerId", id);
  }
  return id;
}

window.firebaseDB = db;
window.firebaseTools = { collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, arrayRemove, onSnapshot, limit, startAfter, documentId };
window.getMySellerId = getMySellerId;
window.firebaseAuth = auth;
window.authTools = { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail };
