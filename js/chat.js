// chat.js – 채팅방/메시지 Firestore 작업
import { db, storage } from "./firebase-config.js";
import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

/**
 * 1:1 채팅방 ID 생성 (두 uid를 정렬해 고정 ID 사용)
 */
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

/**
 * 채팅방 가져오기 or 생성
 */
export async function getOrCreateChat(myUid, friendUid) {
  const chatId = getChatId(myUid, friendUid);
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      members:   [myUid, friendUid],
      lastMsg:   "",
      lastMsgAt: serverTimestamp(),
      unread:    { [myUid]: 0, [friendUid]: 0 }
    });
  }
  return chatId;
}

/**
 * 그룹 채팅방 생성
 */
export async function createGroupChat(memberUids, name) {
  const ref = await addDoc(collection(db, "chats"), {
    members:   memberUids,
    name:      name || "",
    lastMsg:   "",
    lastMsgAt: serverTimestamp(),
    unread:    Object.fromEntries(memberUids.map(u => [u, 0]))
  });
  return ref.id;
}

/**
 * 채팅방에 멤버 초대
 */
export async function inviteToChat(chatId, newUid) {
  await updateDoc(doc(db, "chats", chatId), {
    members: arrayUnion(newUid)
  });
}

/**
 * 내 채팅 목록 실시간 구독
 * @param {string} myUid
 * @param {function} callback - [{id, ...data}] 배열
 * @returns unsubscribe 함수
 */
export function subscribeChats(myUid, callback) {
  const q = query(
    collection(db, "chats"),
    where("members", "array-contains", myUid),
    orderBy("lastMsgAt", "desc")
  );
  return onSnapshot(q, snap => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  });
}

/**
 * 채팅방 메시지 실시간 구독
 * @returns unsubscribe 함수
 */
export function subscribeMessages(chatId, callback) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
}

/**
 * 메시지 전송 (텍스트)
 */
export async function sendMessage(chatId, myUid, text, members) {
  const msgRef = collection(db, "chats", chatId, "messages");
  await addDoc(msgRef, {
    sender:    myUid,
    text:      text,
    type:      "text",
    createdAt: serverTimestamp()
  });

  // 채팅방 메타 업데이트
  const unreadUpdate = {};
  members.forEach(uid => {
    if (uid !== myUid) unreadUpdate[`unread.${uid}`] = increment(1);
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMsg:   text.length > 40 ? text.slice(0, 40) + "…" : text,
    lastMsgAt: serverTimestamp(),
    ...unreadUpdate
  });
}

/**
 * 이미지 메시지 전송
 */
export async function sendImageMessage(chatId, myUid, file, members) {
  const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const msgRef = collection(db, "chats", chatId, "messages");
  await addDoc(msgRef, {
    sender:    myUid,
    text:      url,
    type:      "image",
    createdAt: serverTimestamp()
  });

  const unreadUpdate = {};
  members.forEach(uid => {
    if (uid !== myUid) unreadUpdate[`unread.${uid}`] = increment(1);
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMsg:   "[이미지]",
    lastMsgAt: serverTimestamp(),
    ...unreadUpdate
  });
}

/**
 * 안읽은 메시지 초기화
 */
export async function resetUnread(chatId, myUid) {
  await updateDoc(doc(db, "chats", chatId), {
    [`unread.${myUid}`]: 0
  });
}
