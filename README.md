# EPOS 일일업무 · 주간요약

**epos 관리팀**을 위한 일일 업무 기록 및 팀장용 주간 요약 웹 애플리케이션(MVP)입니다.

## 해결하는 문제

| 기존 | 이 앱 |
|------|--------|
| 직원이 주말/주초에 주간보고서를 각각 작성 | 매일 3~5분, 동일한 양식으로 기록 |
| 팀장이 여러 문서를 열어 비교·평가 | 한 화면에서 제출률·미제출·통합 요약 확인 |

## 주요 화면

1. **일일 기록** (`/daily`)
   - **공종** (전력감시시스템, 조명제어시스템, 유지보수 용역, A/S)
   - **작업 전·후 사진** — 등록 순간에 시각 자동 기록
   - **작업 시간** — 전·후 시각 차이로 자동 산정
   - 금일 수행, 익일 계획, 이슈, **미비사항**
2. **팀장 대시보드** (`/manager`) — 사진 썸네일, 작업시간, 미비사항 포함 주간 요약
3. **AI 주간 분석** (`/manager/analysis`) — Gemini로 지난주 보고서·일일 기록 비교 → 잘한 점/부족한 점/팀장 첨언 정리

## Gemini AI 주간 분석 설정

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급
2. 프로젝트 루트에 `.env.local` 생성:

```
GEMINI_API_KEY=발급받은_키
```

3. `/manager/analysis` 접속 → 지난주 분석 보고서 붙여넣기 → 팀장 첨언 입력 → **Gemini로 주간 분석 생성**

- 제공하신 PDF 형식(종합 평가, 구성원별 👍👎, 전략 체크리스트, 최종 제언)에 맞춰 생성됩니다.
- `data/reference/sample-weekly-analysis.txt`에 5월 2주차 샘플이 포함되어 있습니다.

## 핸드폰·사무실 PC에서 같이 쓰기

여러 기기에서 같은 데이터를 보려면 앱을 인터넷 주소에 배포하고, 저장소를 Firebase로 바꿔야 합니다.

이 프로젝트는 **Firebase 환경변수가 있으면 자동으로 클라우드 저장**을 사용합니다.

- 업무 기록·역사명·팀원 목록: **Firebase Firestore**
- 작업 전·후 사진:
  - Storage 미사용: 작은 사진을 **Firestore 문서 안에 저장** (무료로 시작하기 쉬움, 약 650KB 이하 권장)
  - Storage 사용: 원본 사진을 **Firebase Storage**에 저장
- 환경변수가 없으면 기존처럼 `data/store.json`, `data/uploads/`에 로컬 저장

### 1. Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 생성 (예: `epos-worklog`)
3. **Firestore Database** 생성
4. 프로젝트 설정 → **서비스 계정** → **새 비공개 키 생성**

Storage는 유료 전환 안내가 나오면 만들지 않아도 됩니다. 만들지 않으면 사진을 Firestore에 작게 저장합니다.

### 2. `.env.local`에 Firebase 값 추가

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 넣습니다.

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-firebase-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Gemini까지 쓰려면 같은 파일에 `GEMINI_API_KEY`도 같이 넣으면 됩니다.

Firebase Storage를 나중에 만들면 아래 줄만 추가하면 됩니다.

```env
FIREBASE_STORAGE_BUCKET=Firebase Console에 표시되는 Storage bucket 이름
```

### 3. 외부 접속 주소로 배포

가장 쉬운 방식은 [Vercel](https://vercel.com/) 배포입니다.

1. GitHub에 이 프로젝트 업로드
2. Vercel에서 GitHub 저장소 Import
3. Vercel 프로젝트 설정 → Environment Variables에 `.env.local` 값 등록
4. Deploy

배포 후 나오는 `https://...vercel.app` 주소를 핸드폰과 사무실 PC에서 열면 같은 데이터가 보입니다.

## 실행 방법

1. [Node.js LTS](https://nodejs.org/) 설치 (npm 포함)
2. 프로젝트 폴더에서:

```bash
cd C:\Users\Wonje\projects\epos-worklog
npm install
npm run dev
```

3. 브라우저에서 http://localhost:3000 접속

## 설정

- 최초 실행 시 `data/store.json`이 자동 생성됩니다.
- 팀원 이름·팀장 PIN 변경: `data/store.json` 편집 (예시: `data/store.example.json`)
- **초기 팀장 PIN:** `1234` (운영 전 반드시 변경)

## 오프라인 데모 (Node 없이 UX 체험)

`public/demo/index.html` 파일을 브라우저로 직접 열면 localStorage 기반으로 동작합니다.  
(단일 PC 체험용이며, 팀 공유에는 서버 버전을 사용하세요.)

## 다음 단계 (원하시면 확장 가능)

- [ ] 사내 SSO / 개인 계정 로그인
- [ ] 모바일 앱(PWA) 설치
- [ ] 주간 요약 AI 다듬기·평가 코멘트
- [ ] 슬랙/메일 자동 발송
- [ ] 휴가·공휴일 캘린더 연동

## 프로젝트 구조

```
src/app/daily      직원 일일 입력
src/app/manager    팀장 대시보드
src/lib/summary.ts 주간 요약 생성
data/store.json    팀·보고 데이터 (Firebase 미설정 시 로컬 JSON DB)
```
