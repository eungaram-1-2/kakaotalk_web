// friends.js – 친구 관련 Firestore 작업
import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * 이메일로 사용자 검색
 * @returns {Object|null} 사용자 문서 데이터 (uid 포함)
 */
export async function findUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * 친구 추가 (양방향)
 */
export async function addFriend(myUid, friendUid) {
  await updateDoc(doc(db, "users", myUid),     { friends: arrayUnion(friendUid) });
  await updateDoc(doc(db, "users", friendUid), { friends: arrayUnion(myUid) });
}

/**
 * 친구 목록 조회 (uid 배열 → 사용자 문서 배열)
 */
export async function getFriends(friendUids) {
  if (!friendUids || friendUids.length === 0) return [];
  const results = await Promise.all(
    friendUids.map(uid => getDoc(doc(db, "users", uid)))
  );
  return results
    .filter(s => s.exists())
    .map(s => ({ uid: s.id, ...s.data() }));
}

/**
 * 사용자 프로필 조회
 */
export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}
