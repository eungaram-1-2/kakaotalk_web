// ─────────────────────────────────────────────────────
//  firebase-config.js
//  Firebase SDK 초기화 + 내보내기
//
//  ★ Firebase 콘솔(https://console.firebase.google.com)에서
//    프로젝트를 만든 뒤 아래 값을 교체하세요.
// ─────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ★★★ 여기를 본인 Firebase 프로젝트 설정으로 교체하세요 ★★★
const firebaseConfig = {
  apiKey:            "AIzaSyCy3nVHLs-AtvA-vNhXGoQX33de_W_GuWg",
  authDomain:        "dddd-79e68.firebaseapp.com",
  projectId:         "dddd-79e68",
  storageBucket:     "dddd-79e68.firebasestorage.app",
  messagingSenderId: "72970755586",
  appId:             "1:72970755586:web:512a766f67e973985f911b",
  measurementId:     "G-FHYQR4K8J2"
};
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
