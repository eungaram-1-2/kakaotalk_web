// ui.js – app.html 메인 UI 로직
import { auth, db, storage } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, onSnapshot, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

import { findUserByEmail, addFriend, getFriends, getUser } from "./friends.js";
import {
  getOrCreateChat, createGroupChat, inviteToChat,
  subscribeChats, subscribeMessages,
  sendMessage, sendImageMessage, resetUnread
} from "./chat.js";

// ─── 전역 상태 ───────────────────────────────────
let me = null;               // 내 사용자 문서
let activeChatId = null;     // 현재 열린 채팅방 ID
let activeChatData = null;   // 현재 채팅방 데이터
let unsubMessages = null;    // 메시지 구독 해제 함수
let unsubChats = null;       // 채팅 목록 구독 해제 함수
let unsubMyDoc = null;       // 내 문서 구독 해제 함수
let allChats = [];           // 채팅 목록 캐시
let newChatSelectedUid = null;
let inviteSelectedUid = null;

// ─── 유틸 ─────────────────────────────────────────
function initial(name) {
  return (name || "?")[0].toUpperCase();
}

function avatarEl(photoUrl, name, cls = "") {
  if (photoUrl) {
    return `<img src="${photoUrl}" alt="${name}" />`;
  }
  return `<span>${initial(name)}</span>`;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function formatDateDivider(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

function msgTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "오전" : "오후";
  const h12 = d.getHours() % 12 || 12;
  return `${ampm} ${h12}:${m}`;
}

function openModal(id)  { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

// ─── 초기화 ──────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  // 내 문서 실시간 구독
  unsubMyDoc = onSnapshot(doc(db, "users", user.uid), snap => {
    if (!snap.exists()) return;
    me = { uid: user.uid, ...snap.data() };
    renderMyProfile();
    loadFriends();
  });

  document.getElementById("loadingOverlay").style.display = "none";

  // 채팅 목록 구독
  unsubChats = subscribeChats(user.uid, chats => {
    allChats = chats;
    renderChatList(chats);
  });
});

// ─── 내 프로필 렌더 ──────────────────────────────
function renderMyProfile() {
  if (!me) return;
  const name   = me.name || me.email;
  const status = me.statusMsg || "상태메시지를 입력하세요";
  const photo  = me.photo || "";

  // 사이드바
  const sb = document.getElementById("sidebarProfile");
  sb.innerHTML = photo
    ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : initial(name);

  // 친구탭 내 프로필
  document.getElementById("myInitial").textContent = initial(name);
  document.getElementById("myProfileName").textContent = name;
  document.getElementById("myProfileStatus").textContent = status;
  if (photo) {
    document.getElementById("myProfileAvatar").innerHTML = `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;" />`;
  }

  // 설정탭
  document.getElementById("settingsName").textContent  = name;
  document.getElementById("settingsStatus").textContent = status;
  document.getElementById("settingsEmail").textContent  = me.email;
  document.getElementById("settingsInitial").textContent = initial(name);
  if (photo) {
    document.getElementById("settingsAvatar").innerHTML =
      `<img src="${photo}" /><div class="settings-avatar-edit">변경</div><input type="file" id="avatarFileInput" accept="image/*" style="display:none" />`;
    bindAvatarInput();
  }
}

// ─── 친구 목록 렌더 ──────────────────────────────
async function loadFriends() {
  if (!me) return;
  const friends = await getFriends(me.friends || []);
  document.getElementById("friendCount").textContent = friends.length;

  const list = document.getElementById("friendList");
  list.innerHTML = friends.map(f => `
    <div class="friend-item" data-uid="${f.uid}" data-email="${f.email}">
      <div class="friend-avatar">${avatarEl(f.photo, f.name)}</div>
      <div class="friend-info">
        <div class="friend-name">${f.name || f.email}</div>
        <div class="friend-status">${f.statusMsg || ""}</div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".friend-item").forEach(el => {
    el.addEventListener("click", async () => {
      const fuid = el.dataset.uid;
      const chatId = await getOrCreateChat(me.uid, fuid);
      switchTab("chats");
      openChat(chatId);
    });
  });
}

// ─── 채팅 목록 렌더 ──────────────────────────────
async function renderChatList(chats) {
  const list = document.getElementById("chatList");
  if (chats.length === 0) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:#bbb;font-size:13px;">채팅이 없습니다.<br/>친구를 추가하고 채팅을 시작하세요.</div>`;
    return;
  }

  // 멤버 이름 조회 (캐시 없이 간단 처리)
  const rendered = await Promise.all(chats.map(async chat => {
    const otherUids = (chat.members || []).filter(u => u !== me.uid);
    let chatName = chat.name || "";
    let photo = "";

    if (!chatName) {
      if (otherUids.length === 1) {
        const other = await getUser(otherUids[0]);
        chatName = other ? (other.name || other.email) : "알 수 없음";
        photo = other ? (other.photo || "") : "";
      } else {
        chatName = `단체채팅 (${chat.members.length}명)`;
      }
    }

    const unread = (chat.unread || {})[me.uid] || 0;
    const isActive = chat.id === activeChatId;

    return `
      <div class="chat-item ${isActive ? "active" : ""}" data-id="${chat.id}">
        <div class="chat-item-avatar">
          ${photo ? `<img src="${photo}" />` : `<span>${initial(chatName)}</span>`}
        </div>
        <div class="chat-item-info">
          <div class="chat-item-name">${chatName}</div>
          <div class="chat-item-preview">${chat.lastMsg || ""}</div>
        </div>
        <div class="chat-item-meta">
          <div class="chat-item-time">${formatTime(chat.lastMsgAt)}</div>
          ${unread > 0 ? `<div class="unread-badge">${unread > 99 ? "99+" : unread}</div>` : ""}
        </div>
      </div>`;
  }));

  list.innerHTML = rendered.join("");

  list.querySelectorAll(".chat-item").forEach(el => {
    el.addEventListener("click", () => openChat(el.dataset.id));
  });
}

// ─── 채팅창 열기 ─────────────────────────────────
async function openChat(chatId) {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }

  activeChatId = chatId;
  const chatDocSnap = await getDoc(doc(db, "chats", chatId));
  activeChatData = { id: chatId, ...chatDocSnap.data() };

  // 헤더 이름
  const otherUids = (activeChatData.members || []).filter(u => u !== me.uid);
  let chatName = activeChatData.name || "";
  if (!chatName) {
    if (otherUids.length === 1) {
      const other = await getUser(otherUids[0]);
      chatName = other ? (other.name || other.email) : "알 수 없음";
    } else {
      chatName = `단체채팅 (${activeChatData.members.length}명)`;
    }
  }

  document.getElementById("chatHeaderName").textContent  = chatName;
  document.getElementById("chatHeaderCount").textContent =
    activeChatData.members.length > 2 ? activeChatData.members.length + "명" : "";

  document.getElementById("chatEmpty").style.display  = "none";
  const win = document.getElementById("chatWindow");
  win.style.display = "flex";

  // 안읽음 초기화
  await resetUnread(chatId, me.uid);

  // 메시지 구독
  unsubMessages = subscribeMessages(chatId, msgs => renderMessages(msgs, activeChatData.members));

  // 채팅 목록 active 표시 갱신
  document.querySelectorAll(".chat-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === chatId);
  });
}

// ─── 메시지 렌더 ─────────────────────────────────
async function renderMessages(msgs, members) {
  const container = document.getElementById("chatMessages");
  const atBottom  = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  // 멤버 프로필 캐시
  const profileCache = {};
  await Promise.all(members.map(async uid => {
    if (!profileCache[uid]) profileCache[uid] = await getUser(uid);
  }));

  let lastDate = "";
  let html = "";

  for (let i = 0; i < msgs.length; i++) {
    const msg   = msgs[i];
    const isMe  = msg.sender === me.uid;
    const sender = profileCache[msg.sender] || { name: "알 수 없음", photo: "" };

    // 날짜 구분선
    const msgDate = msg.createdAt ? formatDateDivider(msg.createdAt) : "";
    if (msgDate && msgDate !== lastDate) {
      html += `<div class="date-divider"><span>${msgDate}</span></div>`;
      lastDate = msgDate;
    }

    const time = msgTime(msg.createdAt);
    const bubbleContent = msg.type === "image"
      ? `<img src="${msg.text}" alt="이미지" class="msg-img" data-src="${msg.text}" />`
      : escapeHtml(msg.text);

    html += `
      <div class="msg-group ${isMe ? "me" : ""}">
        ${!isMe ? `<div class="msg-group-avatar">${avatarEl(sender.photo, sender.name)}</div>` : ""}
        <div class="msg-group-body">
          ${!isMe ? `<div class="msg-sender-name">${sender.name || sender.email}</div>` : ""}
          <div class="msg-row">
            ${isMe ? `<div class="msg-time">${time}</div>` : ""}
            <div class="bubble ${isMe ? "me" : "other"}">${bubbleContent}</div>
            ${!isMe ? `<div class="msg-time">${time}</div>` : ""}
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;

  // 이미지 클릭 → 뷰어
  container.querySelectorAll(".msg-img").forEach(img => {
    img.addEventListener("click", () => {
      document.getElementById("imgViewerSrc").src = img.dataset.src;
      document.getElementById("imgViewer").classList.remove("hidden");
    });
  });

  if (atBottom) container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── 메시지 전송 ──────────────────────────────────
async function doSend() {
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text || !activeChatId) return;
  input.value = "";
  input.style.height = "auto";
  await sendMessage(activeChatId, me.uid, text, activeChatData.members);
  document.getElementById("chatMessages").scrollTop = 999999;
}

document.getElementById("btnSend").addEventListener("click", doSend);

document.getElementById("chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSend();
  }
});

document.getElementById("chatInput").addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// 이미지 전송
document.getElementById("imgFileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file || !activeChatId) return;
  e.target.value = "";
  await sendImageMessage(activeChatId, me.uid, file, activeChatData.members);
});

// ─── 탭 전환 ─────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".sidebar-tab, .sidebar-tab-settings").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));

  const map = { friends: "tabFriends", chats: "tabChats", settings: "tabSettings" };
  const el  = document.getElementById(map[tab]);
  if (el) el.classList.add("active");
}

document.querySelectorAll(".sidebar-tab, .sidebar-tab-settings").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ─── 친구 추가 ───────────────────────────────────
document.getElementById("btnAddFriend").addEventListener("click", () => {
  document.getElementById("addFriendEmail").value = "";
  document.getElementById("addFriendError").textContent = "";
  openModal("modalAddFriend");
});
document.getElementById("btnCancelAddFriend").addEventListener("click", () => closeModal("modalAddFriend"));
document.getElementById("btnConfirmAddFriend").addEventListener("click", async () => {
  const email = document.getElementById("addFriendEmail").value.trim();
  const errEl = document.getElementById("addFriendError");
  errEl.textContent = "";
  if (!email) { errEl.textContent = "이메일을 입력하세요."; return; }
  if (email === me.email) { errEl.textContent = "본인은 추가할 수 없어요."; return; }

  const found = await findUserByEmail(email);
  if (!found) { errEl.textContent = "해당 이메일의 사용자를 찾을 수 없습니다."; return; }
  if ((me.friends || []).includes(found.uid)) { errEl.textContent = "이미 친구입니다."; return; }

  await addFriend(me.uid, found.uid);
  closeModal("modalAddFriend");
});

// ─── 새 채팅 ─────────────────────────────────────
document.getElementById("btnNewChat").addEventListener("click", async () => {
  newChatSelectedUid = null;
  document.getElementById("newChatSearch").value = "";
  await renderNewChatFriendList("");
  openModal("modalNewChat");
});

async function renderNewChatFriendList(query) {
  const friends = await getFriends(me.friends || []);
  const filtered = friends.filter(f =>
    (f.name || f.email).toLowerCase().includes(query.toLowerCase())
  );
  const el = document.getElementById("newChatFriendList");
  el.innerHTML = filtered.map(f => `
    <div class="friend-item" data-uid="${f.uid}" style="border-radius:8px;margin-bottom:2px;">
      <div class="friend-avatar" style="width:36px;height:36px;border-radius:10px;font-size:14px;">
        ${avatarEl(f.photo, f.name)}
      </div>
      <div class="friend-info">
        <div class="friend-name" style="font-size:13px;">${f.name || f.email}</div>
      </div>
      <div style="font-size:18px;color:transparent;" class="sel-icon">○</div>
    </div>
  `).join("") || `<div style="text-align:center;color:#bbb;padding:16px;font-size:13px;">친구가 없습니다.</div>`;

  el.querySelectorAll(".friend-item").forEach(item => {
    item.addEventListener("click", () => {
      el.querySelectorAll(".friend-item").forEach(i => {
        i.style.background = "";
        i.querySelector(".sel-icon").style.color = "transparent";
      });
      newChatSelectedUid = item.dataset.uid;
      item.style.background = "#fff9c4";
      item.querySelector(".sel-icon").style.color = "#f5a623";
      item.querySelector(".sel-icon").textContent = "●";
    });
  });
}

document.getElementById("newChatSearch").addEventListener("input", e => {
  renderNewChatFriendList(e.target.value);
});

document.getElementById("btnCancelNewChat").addEventListener("click", () => closeModal("modalNewChat"));
document.getElementById("btnConfirmNewChat").addEventListener("click", async () => {
  if (!newChatSelectedUid) return;
  const chatId = await getOrCreateChat(me.uid, newChatSelectedUid);
  closeModal("modalNewChat");
  switchTab("chats");
  openChat(chatId);
});

// ─── 대화상대 초대 ────────────────────────────────
document.getElementById("btnInviteChat").addEventListener("click", async () => {
  inviteSelectedUid = null;
  document.getElementById("inviteSearch").value = "";
  await renderInviteFriendList("");
  openModal("modalInviteChat");
});

async function renderInviteFriendList(query) {
  const friends = await getFriends(me.friends || []);
  const existingMembers = activeChatData ? activeChatData.members : [];
  const filtered = friends.filter(f =>
    !existingMembers.includes(f.uid) &&
    (f.name || f.email).toLowerCase().includes(query.toLowerCase())
  );
  const el = document.getElementById("inviteFriendList");
  el.innerHTML = filtered.map(f => `
    <div class="friend-item" data-uid="${f.uid}" style="border-radius:8px;margin-bottom:2px;">
      <div class="friend-avatar" style="width:36px;height:36px;border-radius:10px;font-size:14px;">
        ${avatarEl(f.photo, f.name)}
      </div>
      <div class="friend-info">
        <div class="friend-name" style="font-size:13px;">${f.name || f.email}</div>
      </div>
      <div style="font-size:18px;color:transparent;" class="sel-icon">○</div>
    </div>
  `).join("") || `<div style="text-align:center;color:#bbb;padding:16px;font-size:13px;">초대할 친구가 없습니다.</div>`;

  el.querySelectorAll(".friend-item").forEach(item => {
    item.addEventListener("click", () => {
      el.querySelectorAll(".friend-item").forEach(i => {
        i.style.background = "";
        i.querySelector(".sel-icon").style.color = "transparent";
      });
      inviteSelectedUid = item.dataset.uid;
      item.style.background = "#fff9c4";
      item.querySelector(".sel-icon").style.color = "#f5a623";
      item.querySelector(".sel-icon").textContent = "●";
    });
  });
}

document.getElementById("inviteSearch").addEventListener("input", e => renderInviteFriendList(e.target.value));
document.getElementById("btnCancelInvite").addEventListener("click", () => closeModal("modalInviteChat"));
document.getElementById("btnConfirmInvite").addEventListener("click", async () => {
  if (!inviteSelectedUid || !activeChatId) return;
  await inviteToChat(activeChatId, inviteSelectedUid);
  // 채팅 데이터 갱신
  activeChatData.members.push(inviteSelectedUid);
  closeModal("modalInviteChat");
});

// ─── 채팅 검색 필터 ───────────────────────────────
document.getElementById("chatSearch").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll(".chat-item").forEach(el => {
    const name = el.querySelector(".chat-item-name").textContent.toLowerCase();
    el.style.display = name.includes(q) ? "" : "none";
  });
});

// ─── 설정: 이름 수정 ──────────────────────────────
document.getElementById("btnEditName").addEventListener("click", () => {
  document.getElementById("editNameInput").value = me.name || "";
  openModal("modalEditName");
});
document.getElementById("btnCancelEditName").addEventListener("click", () => closeModal("modalEditName"));
document.getElementById("btnConfirmEditName").addEventListener("click", async () => {
  const name = document.getElementById("editNameInput").value.trim();
  if (!name) return;
  await updateDoc(doc(db, "users", me.uid), { name });
  closeModal("modalEditName");
});

// ─── 설정: 상태메시지 수정 ────────────────────────
document.getElementById("btnEditStatus").addEventListener("click", () => {
  document.getElementById("editStatusInput").value = me.statusMsg || "";
  openModal("modalEditStatus");
});
document.getElementById("btnCancelEditStatus").addEventListener("click", () => closeModal("modalEditStatus"));
document.getElementById("btnConfirmEditStatus").addEventListener("click", async () => {
  const statusMsg = document.getElementById("editStatusInput").value.trim();
  await updateDoc(doc(db, "users", me.uid), { statusMsg });
  closeModal("modalEditStatus");
});

// ─── 설정: 프로필 사진 변경 ───────────────────────
function bindAvatarInput() {
  const avatarEl = document.getElementById("settingsAvatar");
  const fileInput = document.getElementById("avatarFileInput");
  if (avatarEl && fileInput) {
    avatarEl.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      const storageRef = ref(storage, `avatars/${me.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", me.uid), { photo: url });
    });
  }
}
bindAvatarInput();

document.getElementById("settingsAvatar").addEventListener("click", () => {
  document.getElementById("avatarFileInput")?.click();
});

// ─── 로그아웃 ─────────────────────────────────────
document.getElementById("btnLogout").addEventListener("click", async () => {
  if (unsubMessages) unsubMessages();
  if (unsubChats)    unsubChats();
  if (unsubMyDoc)    unsubMyDoc();
  await signOut(auth);
  location.href = "index.html";
});

// ─── 이미지 뷰어 닫기 ─────────────────────────────
document.getElementById("imgViewer").addEventListener("click", () => {
  document.getElementById("imgViewer").classList.add("hidden");
});

// ─── 모달 바깥 클릭 닫기 ─────────────────────────
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

// ─── 내 프로필 클릭 → 설정탭 ─────────────────────
document.getElementById("sidebarProfile").addEventListener("click", () => switchTab("settings"));
document.getElementById("myProfile").addEventListener("click", () => {
  document.getElementById("editStatusInput").value = me.statusMsg || "";
  openModal("modalEditStatus");
});
