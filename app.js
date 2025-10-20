// 🔹 Importamos las funciones base de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

// 🔹 Importamos las funciones de Firestore y Auth que vamos a usar
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, query, where, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// 🔹 Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCjpolNK16Q53pPzXG6svKChtMT8_kmo80",
  authDomain: "siga-d0f26.firebaseapp.com",
  projectId: "siga-d0f26",
  storageBucket: "siga-d0f26.firebasestorage.app",
  messagingSenderId: "655818690283",
  appId: "1:655818690283:web:b6e3b9ee262b6c380138ae",
  measurementId: "G-YGKZSCYMLW"
};

// 🔹 Inicializamos Firebase
const app = initializeApp(firebaseConfig);
console.log("✅ Firebase inicializado correctamente. Proyecto:", firebaseConfig.projectId);
getAnalytics(app);

// 🔹 Exportamos las instancias de DB y Auth para usarlas en otros scripts
const db = getFirestore(app);
const auth = getAuth(app);

// 🔹 Inicializamos una instancia secundaria de Firebase para operaciones de admin
const secondaryApp = initializeApp(firebaseConfig, "admin-operations");
const secondaryAuth = getAuth(secondaryApp);


export { db, auth, secondaryAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, collection, getDocs, setDoc, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, query, where, deleteDoc, updateDoc };
