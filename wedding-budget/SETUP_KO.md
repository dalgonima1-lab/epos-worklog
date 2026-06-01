# 우리 결혼자금 노트 — 처음부터 끝까지 설정 (EPOS와 완전 분리)

이 폴더는 **회사 EPOS 업무 앱과 무관한 개인용** 앱입니다.  
Firebase·Vercel·GitHub를 **새로** 만듭니다.

---

## 당신이 할 일 — 전체 순서

### 1단계. Firebase 프로젝트 만들기 (10분)

1. [Firebase Console](https://console.firebase.google.com/) 로그인
2. **프로젝트 추가** → 이름 예: `our-wedding-budget` (EPOS 프로젝트와 **다른 이름**)
3. Google Analytics는 **끄거나 켜도 됨** → 만들기
4. 왼쪽 **Firestore Database** → **데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)` 권장
   - 보안 규칙: **테스트 모드**로 시작해도 됨 (실제 접근은 Vercel 서버만 함)
5. ⚙ **프로젝트 설정** → **서비스 계정** → **새 비공개 키 생성** → JSON 파일 다운로드  
   → PC에 안전하게 보관 (카톡·메일로 보내지 마세요)

---

### 2단계. 이 폴더 로컬 설정 (5분)

1. PowerShell:

```powershell
cd C:\Users\Wonje\projects\epos-worklog\wedding-budget
npm install
```

2. `.env.example` 을 복사해 `.env.local` 생성

3. 다운로드한 JSON에서 아래 3값을 넣기:

| `.env.local` 키 | JSON 필드 |
|-----------------|-----------|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` 전체 (한 줄, `\n` 유지) |

4. (선택) 둘만 아는 PIN:

```env
WEDDING_ACCESS_PIN=원하는4자리
```

5. 로컬 실행·확인:

```powershell
npm run dev
```

브라우저: http://localhost:3001  
http://localhost:3001/api/health → `firebaseConfigured: true` 확인

---

### 3단계. GitHub 저장소 분리 (15분)

**EPOS repo와 분리**하려면 새 저장소를 만듭니다.

1. GitHub → **New repository** → 이름 예: `our-wedding-budget` → Private 권장
2. PowerShell (`wedding-budget` 폴더만 올리기):

```powershell
cd C:\Users\Wonje\projects\epos-worklog\wedding-budget
git init
git add .
git commit -m "Initial: our wedding budget app"
git branch -M main
git remote add origin https://github.com/본인아이디/our-wedding-budget.git
git push -u origin main
```

> `epos-worklog` 안에 `wedding-budget` 폴더만 있는 상태라면,  
> 위처럼 **이 폴더에서 새 repo**를 만드는 것이 가장 깔끔합니다.

---

### 4단계. Vercel 배포 (10분)

1. [Vercel](https://vercel.com) → **Add New Project**
2. 방금 만든 **`our-wedding-budget` 저장소** Import (EPOS 저장소 ❌)
3. **Root Directory** 비움 (이 repo 루트가 앱 전체)
4. **Environment Variables** — `.env.local`과 **동일 3개** (+ 선택 PIN)  
   Production / Preview 모두 체크
5. **Deploy**
6. 완료 후 주소 예: `https://our-wedding-budget.vercel.app` → 이게 **평생 공유 링크**

---

### 5단계. 폰·상대방 (2분)

1. 배포 URL을 폰 Chrome/Safari에서 연다
2. **홈 화면에 추가**
3. 카톡으로 URL만 신랑/신부에게 전달
4. (PIN 썼으면 PIN도 전달)
5. 예전에 PC HTML만 쓰다면 → 「클라우드로 옮길까요?」 **예**

---

### 6단계. 이후 운영

| 할 일 | 주기 |
|--------|------|
| URL·PIN을 검색/공개 글에 올리지 않기 | 항상 |
| 한 달에 한 번 **백업보내기** JSON 저장 | 월 1회 |
| 기능 수정 후 `git push` → Vercel 자동 배포 | 필요 시 |

---

## EPOS와 무엇이 다른지

| | EPOS 업무 | 이 앱 |
|--|-----------|--------|
| Firebase | 회사 프로젝트 | **본인 새 프로젝트** |
| Vercel | epos-worklog | **our-wedding-budget** |
| Firestore | `epos-worklog/main` | **`couple-budget/main`** |
| URL | 회사 주소 | **결혼 전용 주소** |

---

## 문제 해결

- **저장 안 됨** → `/api/health` 에서 Firebase false → env 다시 확인 → Redeploy
- **폰만 다름** → `file://` HTML 말고 **https 배포 주소** 사용
- **PIN 오류** → Vercel `WEDDING_ACCESS_PIN` 과 입력값 일치, Redeploy

---

## 로컬만 쓰기 (배포 전)

Firebase env 없이도 `data/store.json`에 저장됩니다.  
둘이 공유하려면 **4단계 Vercel 배포까지** 해야 합니다.
