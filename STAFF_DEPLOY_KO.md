# 직원 전용 배포 가이드

팀장용 사이트와 **같은 GitHub·같은 Firebase**를 쓰되, 직원은 **일일 기록만** 보이게 하는 두 번째 Vercel 배포입니다.

## 동작 요약

| 구분 | 팀장용 배포 | 직원용 배포 |
|------|-------------|-------------|
| 환경변수 `NEXT_PUBLIC_STAFF_ONLY` | 없음 또는 `false` | **`true`** |
| 홈 `/` | 팀장·직원 안내 | 자동으로 `/daily` 로 이동 |
| 메뉴 | 홈, 일일 기록, 팀장, AI | **일일 기록만** |
| `/manager`, `/manager/analysis` | 사용 가능 | 접속 시 `/daily` 로 리다이렉트 |
| API `summary`, `analysis`, `auth/manager` | 사용 가능 | **403** |

데이터는 **같은 Firestore** (`epos-worklog` / `main`) 를 쓰므로, 팀장이 대시보드에서 직원이 쓴 기록을 그대로 봅니다.

## Vercel에서 직원용 프로젝트 만들기

1. [Vercel](https://vercel.com) → **Add New Project**
2. **같은 GitHub 저장소** 선택 (팀장용과 동일)
3. 프로젝트 이름 예: `epos-worklog-staff` (아무 이름이나 가능)
4. **Environment Variables** 에 팀장용과 **동일한** Firebase 변수를 넣습니다.
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - (있으면) `FIREBASE_STORAGE_BUCKET`
5. **추가로** 아래를 넣습니다.

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_STAFF_ONLY` | `true` |

6. **Production**, **Preview** 모두 체크 후 저장
7. **Deploy**

배포가 끝나면 나오는 주소(예: `https://epos-worklog-staff.vercel.app`)를 **직원에게만** 공유합니다.

## 로컬에서 직원 모드 테스트

PowerShell:

```powershell
cd C:\Users\Wonje\projects\epos-worklog
$env:NEXT_PUBLIC_STAFF_ONLY="true"
npm.cmd run dev
```

브라우저에서 `http://localhost:3000` → 자동으로 `/daily` 로 이동하는지 확인합니다.

테스트 후 터미널을 닫거나 `Remove-Item Env:NEXT_PUBLIC_STAFF_ONLY` 로 원복할 수 있습니다.

## 주의

- `NEXT_PUBLIC_STAFF_ONLY` 는 **빌드 시** 클라이언트에 반영됩니다. 값을 바꾼 뒤에는 **Redeploy** 가 필요합니다.
- 직원용 URL을 알면 주소만으로 `/api/reports` 등은 호출할 수 있습니다. PIN으로 보호되는 것은 **팀장 화면**뿐입니다. 내부용 URL 관리만 해 주시면 됩니다.
