# EPOS 업무앱 — Firebase + Vercel 배포 가이드

대표님이 **직접 할 일**과 **제가 코드로 해둔 일**을 구분해서 적었습니다.

---

## 제가 해둔 것 (코드)

- Firebase Firestore 연동 코드
- Storage 없이도 사진 저장 가능 (Firestore에 작은 사진)
- Vercel 배포 설정 (`vercel.json`)
- 연결 상태 확인 주소: `/api/health`

---

## 전체 순서 (한눈에)

1. Firebase 프로젝트 만들기 + Firestore 켜기
2. 서비스 계정 키(JSON) 받기
3. PC에 `.env.local` 넣기 (이미 있으면 값만 확인)
4. Vercel에 배포 + 같은 값을 환경변수로 등록
5. 배포 주소를 팀원에게 공유

---

## 1단계 — Firebase (약 10분)

### 1-1. 프로젝트 만들기

1. 브라우저에서 [Firebase Console](https://console.firebase.google.com/) 접속
2. **프로젝트 추가** 클릭
3. 이름 예: `epos-worklog`
4. Google 애널리틱스는 **꺼도 됨** (필수 아님)

### 1-2. Firestore 켜기

1. 왼쪽 메뉴 **Firestore Database**
2. **데이터베이스 만들기**
3. **프로덕션 모드** 선택 → 위치 **asia-northeast3 (서울)** 권장
4. 만들기 완료까지 1~2분 대기

> 처음에 `PERMISSION_DENIED` / API 미사용 오류가 나오면 5분 정도 기다렸다가 다시 시도하세요.

### 1-3. 보안 규칙 (복사해서 붙여넣기)

1. Firestore → **규칙** 탭
2. 프로젝트의 `firebase/firestore.rules` 내용과 같이 **전부 거부** 규칙 사용 (서버만 DB 접근)
3. **게시** 클릭

### 1-4. 서비스 계정 키 받기 (중요)

1. ⚙ **프로젝트 설정** → **서비스 계정**
2. **새 비공개 키 생성** → JSON 파일 다운로드
3. JSON 파일은 **채팅·메일에 올리지 마세요** (비밀번호와 같습니다)

JSON 안에서 필요한 값:

| JSON 필드 | `.env.local` 변수명 |
|-----------|---------------------|
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_PRIVATE_KEY` |

### 1-5. PC에 `.env.local` 만들기

폴더: `C:\Users\Wonje\projects\epos-worklog`

`.env.example`을 복사해서 `.env.local`로 저장한 뒤 값을 채웁니다.

```env
FIREBASE_PROJECT_ID=여기에_project_id
FIREBASE_CLIENT_EMAIL=여기에_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n여기에_한줄로_붙여넣기\n-----END PRIVATE KEY-----\n"

# AI 주간분석 쓸 때만
GEMINI_API_KEY=선택
```

`FIREBASE_PRIVATE_KEY`는 JSON의 `private_key` 값을 **그대로** 넣되, 줄바꿈은 `\n`으로 되어 있어야 합니다.

**Storage는 안 만들어도 됩니다.** (비용 걱정 없이 시작)

### 1-6. 연결 확인 (PC)

PowerShell:

```powershell
cd C:\Users\Wonje\projects\epos-worklog
npm.cmd run dev
```

브라우저에서:

```text
http://localhost:3000/api/health
```

아래처럼 나오면 성공:

```json
"firebaseConfigured": true
"storageMode": "firestore-inline-photos"
```

---

## 2단계 — Vercel 배포 (약 15분)

Git이 없어도 됩니다. **Vercel 웹사이트**만으로 가능합니다.

### 방법 A — Vercel CLI (추천, Git 불필요)

PowerShell:

```powershell
cd C:\Users\Wonje\projects\epos-worklog
npx vercel login
npx vercel
```

질문이 나오면:

- 프로젝트 이름: Enter (기본값)
- 배포: **Yes**

배포가 끝나면 `https://xxxx.vercel.app` 주소가 나옵니다.

**환경변수 등록** (필수):

```powershell
npx vercel env add FIREBASE_PROJECT_ID
npx vercel env add FIREBASE_CLIENT_EMAIL
npx vercel env add FIREBASE_PRIVATE_KEY
npx vercel env add GEMINI_API_KEY
```

각각 `.env.local`과 **같은 값**을 입력합니다.

다시 배포:

```powershell
npx vercel --prod
```

### 방법 B — GitHub + Vercel 웹

1. GitHub에 저장소 만들고 코드 업로드
2. [vercel.com](https://vercel.com) 로그인
3. **Add New Project** → GitHub 저장소 선택
4. **Environment Variables**에 `.env.local`과 동일한 값 입력
5. **Deploy**

---

## 3단계 — 팀원에게 공유

1. 배포 주소 예: `https://epos-worklog.vercel.app`
2. 핸드폰 Chrome/Edge 주소창에 입력
3. **홈 화면에 추가** (PWA) — 앱처럼 사용

| 화면 | 경로 |
|------|------|
| 일일 기록 | `/daily` |
| 팀장 대시보드 | `/manager` |
| AI 분석 | `/manager/analysis` |

팀장 PIN 기본값: `1234` → 배포 후 `/manager`에서 변경하거나 Firestore 데이터에서 변경

---

## 자주 나는 오류

| 증상 | 해결 |
|------|------|
| Firestore PERMISSION_DENIED | Firestore DB 생성 후 5분 대기 |
| 작성자 탭이 비어 있음 | `/api/members` 새로고침, Firebase 연결 확인 |
| 사진이 안 올라감 | 사진 크기 650KB 이하, 또는 Storage 설정 |
| 배포 후 데이터가 비어 있음 | 정상 — 첫 접속 시 빈 DB 생성됨. 로컬 `data/store.json` 데이터는 별도 이전 필요 |

---

## 다음에 제가 도와드릴 수 있는 것

- 로컬 `data/store.json` 데이터를 Firebase로 옮기기
- 팀장 PIN 변경
- Vercel 환경변수 화면 보면서 같이 입력하기

준비되면 **Firebase JSON 키를 받으셨는지**만 알려주세요. (키 내용은 채팅에 붙이지 마세요)
