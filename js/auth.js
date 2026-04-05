// auth.js – index.html 전용 (로그인 페이지)
import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 이미 로그인돼 있으면 app.html로 이동
onAuthStateChanged(auth, user => {
  if (user) location.href = "app.html";
});

// Firestore에 사용자 문서 생성 (없으면)
async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:       user.uid,
      name:      user.displayName || user.email.split("@")[0],
      email:     user.email,
      photo:     user.photoURL || "",
      statusMsg: "",
      friends:   [],
      createdAt: serverTimestamp()
    });
  }
}

function showError(msg) {
  document.getElementById("loginError").textContent = msg;
}

// Google 로그인
document.getElementById("btnGoogle").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDoc(result.user);
    location.href = "app.html";
  } catch (e) {
    showError("Google 로그인에 실패했습니다: " + e.message);
  }
});

// 이메일 로그인
document.getElementById("btnEmailLogin").addEventListener("click", async () => {
  const email    = document.getElementById("inputEmail").value.trim();
  const password = document.getElementById("inputPassword").value;
  if (!email || !password) { showError("이메일과 비밀번호를 입력하세요."); return; }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(result.user);
    location.href = "app.html";
  } catch (e) {
    showError("로그인 실패: 이메일 또는 비밀번호를 확인하세요.");
  }
});

// 이메일 회원가입
document.getElementById("btnEmailSignup").addEventListener("click", async () => {
  const email    = document.getElementById("inputEmail").value.trim();
  const password = document.getElementById("inputPassword").value;
  if (!email || !password) { showError("이메일과 비밀번호를 입력하세요."); return; }
  if (password.length < 6)  { showError("비밀번호는 6자 이상이어야 합니다."); return; }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const name = email.split("@")[0];
    await updateProfile(result.user, { displayName: name });
    await ensureUserDoc(result.user);
    location.href = "app.html";
  } catch (e) {
    if (e.code === "auth/email-already-in-use") showError("이미 사용 중인 이메일입니다.");
    else showError("회원가입 실패: " + e.message);
  }
});

// Enter 키 로그인
document.getElementById("inputPassword").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btnEmailLogin").click();
});
