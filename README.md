# KakaoTalk Web (카카오톡 웹 클론)

PC 카카오톡과 유사한 UI의 웹 채팅 앱입니다.  
**Firebase 실시간 채팅 + GitHub Pages 배포** 기반으로 동작합니다.

---

## 주요 기능

- Google / 이메일 로그인 (Firebase Auth)
- 친구 추가 (이메일 기반)
- 1:1 채팅 / 그룹 채팅
- 실시간 메시지 (Firestore onSnapshot)
- 이미지 전송 (Firebase Storage)
- 안읽은 메시지 수 뱃지
- 프로필 사진 / 이름 / 상태메시지 변경
- PC 카카오톡 UI 재현 (노란 말풍선, 채팅 배경 등)

---

## 🔧 Firebase 설정 (필수)

### 1. Firebase 프로젝트 만들기

1. [Firebase 콘솔](https://console.firebase.google.com) 접속
2. **프로젝트 추가** 클릭
3. 프로젝트 이름 입력 후 생성

### 2. 앱 등록

1. 프로젝트 홈 → **웹 앱 추가** (`</>` 버튼)
2. 앱 닉네임 입력 후 등록
3. 표시되는 `firebaseConfig` 값 복사

### 3. `js/firebase-config.js` 수정

```js
const firebaseConfig = {
  apiKey:            "복사한 값",
  authDomain:        "복사한 값",
  projectId:         "복사한 값",
  storageBucket:     "복사한 값",
  messagingSenderId: "복사한 값",
  appId:             "복사한 값"
};
```

### 4. Firebase 서비스 활성화

Firebase 콘솔에서 다음을 **활성화**하세요:

| 서비스 | 설정 위치 |
|--------|----------|
| **Authentication** | 빌드 → Authentication → 로그인 방법 → Google, 이메일/비밀번호 사용 설정 |
| **Firestore** | 빌드 → Firestore Database → 데이터베이스 만들기 (테스트 모드) |
| **Storage** | 빌드 → Storage → 시작하기 (테스트 모드) |

### 5. Firestore 보안 규칙 (권장)

Firebase 콘솔 → Firestore → 규칙 탭에 아래를 붙여넣기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null
        && request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      match /messages/{msgId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### 6. GitHub Pages 승인 도메인 추가

Firebase 콘솔 → Authentication → 설정 → 승인된 도메인 → **`{본인아이디}.github.io`** 추가

---

## 🚀 GitHub Pages 배포

### 1. GitHub 저장소 생성

```bash
git init
git add .
git commit -m "init: KakaoTalk Web 클론"
git remote add origin https://github.com/{아이디}/kakaotalk-web.git
git push -u origin main
```

### 2. GitHub Pages 설정

1. GitHub 저장소 → **Settings** → **Pages**
2. Source: `main` 브랜치, `/ (root)` 선택
3. **Save** 클릭
4. 약 1분 후 `https://{아이디}.github.io/kakaotalk-web` 접속

---

## 파일 구조

```
kakaotalk-web/
├── index.html              # 로그인 페이지
├── app.html                # 메인 앱
├── css/
│   ├── reset.css
│   ├── login.css
│   └── app.css             # PC 카카오톡 UI 스타일
├── js/
│   ├── firebase-config.js  # ★ Firebase 설정 (수정 필요)
│   ├── auth.js             # 로그인/회원가입
│   ├── chat.js             # 채팅 Firestore 로직
│   ├── friends.js          # 친구 Firestore 로직
│   └── ui.js               # 메인 UI 로직
└── assets/
    └── icons/
        └── kakao-logo.svg
```

---

## 기술 스택

- **프론트엔드**: HTML5, CSS3, JavaScript (ES Modules)
- **백엔드**: Firebase (Auth, Firestore, Storage)
- **배포**: GitHub Pages
- **폰트**: Noto Sans KR (Google Fonts)
