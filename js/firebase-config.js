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
  apiKey:            "YOUR_API_KEY",           // ★ Firebase 콘솔에서 복사
  authDomain:        "dddd-79e68.firebaseapp.com",
  projectId:         "dddd-79e68",
  storageBucket:     "dddd-79e68.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // ★ Firebase 콘솔에서 복사
  appId:             "YOUR_APP_ID"               // ★ Firebase 콘솔에서 복사
};
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
