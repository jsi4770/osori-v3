# OSORI v2 — AI 재무 코칭 가계부

사회초년생을 위한 넛지형 AI 재무 코칭 가계부. **AI 재무 코칭**을 새로운 차별화 기능으로 추가했습니다.

- 프론트엔드: https://fincoach-app-beta.vercel.app
- 백엔드 API: https://fincoach-api-production.up.railway.app
- 제품 요구사항: [`docs/PRD.md`](docs/PRD.md)

## 무엇이 다른가

사후 리포트에 그치지 않는 **AI 코칭**(소비 이상치 감지 → 맥락 있는 넛지 → 목표 기반 대화형 코칭 → 성장 리포트)을 새로 만들었습니다. 자세한 배경은 [`docs/PRD.md`](docs/PRD.md) 참고.

## 가계부 코어 — 캘린더뷰 & 고정지출

- **캘린더뷰가 단일 가계부 화면**입니다. 우측 패널에서 날짜를 선택해 그날 내역을 보거나, "이 달 전체" 토글로 전체 목록·검색까지 한 화면에서 처리합니다. 내역 추가/수정/삭제 모두 이 화면에서 처리합니다.
- **고정지출**은 결제일을 1~30일 또는 "매월 말일"로 등록할 수 있고(말일 선택 시 2월엔 28/29일, 30일짜리 달엔 30일로 자동 클램핑), 매일 00:05 스케줄러가 당일 등록 대상을 실제 지출로 자동 반영합니다. 아직 반영되지 않은(오늘 이후) 예정 금액은 캘린더 타일에 회색으로 미리 표시되며 지출 합계에는 잡히지 않고, 실제로 등록된 고정지출 내역은 목록에 "고정지출" 배지로 구분됩니다.
- **카테고리**는 식비/생활·마트/쇼핑/의료·건강/교통/문화·여가/교육/기타에 **주거·월세/통신비/보험/구독서비스**를 추가해 고정지출 성격의 지출도 자연스럽게 분류합니다(`app/src/constants/categories.js` 공용 상수). 홈 화면의 "카테고리 별 소비 분석" 도넛은 전체 카테고리를 다 보여주되 고정비는 무채색, 변동비는 컬러로 구분하고 "고정비 X원 · 변동비 Y원" 요약을 함께 보여줍니다. AI 코칭의 이상치 탐지·코칭 타겟 계산은 고정지출 자동등록 내역을 제외해, 매달 똑같이 나가는 고정비가 "비정상 소비"로 오탐되지 않도록 합니다.
- **설정 화면**은 계정(프로필·이메일·비밀번호·카카오 연동) / 환경설정(화면 테마) / 계정 관리(로그아웃, 위험 구역: 회원탈퇴) 3개 카테고리 섹션으로 구성했습니다.

## 기술 스택

| | |
|---|---|
| 프론트엔드 | React 19 (Vite) · Axios · React Router · Chart.js |
| 백엔드 | Spring Boot 3 · Java 17 · MyBatis · PostgreSQL |
| AI 코칭 | Google Gemini API (무료 티어, `gemini-2.5-flash`) — Mock 폴백 내장 |
| 영수증 OCR | Naver CLOVA OCR (종량제, 기본 비활성화) |
| 환율(외화 입력) | 한국수출입은행 환율 API(무료·과거 영업일 조회) → open.er-api.com 교차환율(키 불필요) → 하드코딩 폴백. `(통화,날짜)` 영구 캐싱 |
| 배포 | 백엔드: Railway · 프론트엔드: Vercel |

## 프로젝트 구조

```
personalPRD/
├─ docs/PRD.md   제품 요구사항
├─ app/          프론트엔드 (React + Vite)
└─ server/       백엔드 (Spring Boot)
```

## 로컬 실행

### 사전 준비: PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
createdb fincoach
```

### 백엔드

```bash
cd server
cp src/main/resources/application.properties.example src/main/resources/application-local.properties
# application-local.properties에 실제 DB 비밀번호/JWT 시크릿/외부 API 키를 채워넣는다
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run   # http://localhost:8080/fincoach
```

`application.properties`(커밋됨, 안전한 기본값)와 `application-local.properties`(gitignore, 실제 로컬 시크릿)는 Spring 프로필로 분리되어 있습니다. `application-local.properties`에 넣은 값이 기본값을 덮어씁니다.

### 프론트엔드

```bash
cd app
npm install
npm run dev   # http://localhost:5174 (또는 다른 포트, vite가 자동 배정)
```

`app/src/api/axios.jsx`, `http.js`는 `VITE_API_BASE_URL`이 없으면 `/fincoach` 상대 경로(Vite 프록시 경유)로 로컬 백엔드를 호출합니다.

## 배포

- **백엔드(Railway)**: `railway up -s fincoach-api` — 환경변수로 `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`(Railway Postgres 서비스 참조), `JWT_SECRET`, `NAVER_OCR_*`, `RECEIPT_OCR_ENABLED`, `COACHING_LLM_ENABLED`, `GEMINI_API_KEY` 등을 주입합니다.
- **이메일 인증(회원가입/비밀번호 재설정)**: `MAIL_ENABLED=true`, `MAIL_USERNAME`(발신 Gmail 주소), `MAIL_PASSWORD`(Gmail 앱 비밀번호 — 2단계 인증 필요)를 주입해야 실제 메일이 발송됩니다. 미설정 시 인증코드는 서버 로그로만 출력되어 회원가입/재설정을 완료할 수 없습니다.
- **외화 입력(환율)**: `FX_ENABLED=true` + `EXIM_FX_KEY`(한국수출입은행 [현재환율 API](https://www.koreaexim.go.kr) 인증키, 무료·카드 불필요)를 주입하면 과거 영업일까지 정확한 환율을 씁니다. 미설정(`FX_ENABLED=false`)이면 `open.er-api.com`(키 불필요) 최신 환율과 하드코딩 폴백으로 동작하며 부정확할 수 있는 값은 "추정"으로 표시됩니다. `FX_DAILY_LIMIT`로 원격 호출 상한을 둡니다.
- **프론트엔드(Vercel)**: `app/.env.production`의 `VITE_API_BASE_URL`이 배포된 Railway 백엔드 URL을 가리키도록 빌드 시 고정합니다.

## 현재 스코프: 무엇이 진짜고 무엇이 Mock인가

- **AI 코칭**: `coaching.llm.enabled=false`(기본값)면 미리 정의된 Mock 코칭 문구로 동작합니다. Gemini API 키를 발급받아 `true`로 바꾸면 실제 LLM 응답으로 전환됩니다. 무료 티어 한도 초과/오류 시에도 자동으로 Mock으로 우아하게 대체됩니다.
- **영수증 OCR**: `receipt.ocr.enabled=false`(기본값)면 비활성화 메시지와 함께 수동 입력으로 유도합니다. CLOVA OCR은 종량제라 기본적으로 꺼져 있습니다.
- **외화 입력**: 수기/자연어 입력에서 통화(원·달러·엔·유로·파운드·위안·대만달러)를 고르면 거래일 환율로 원화 환산해 저장합니다(`MYTRANS.ORIGINAL_AMOUNT`는 항상 원화 — 차트/예산/코칭은 무영향). 원본 외화금액·적용 환율·기준일을 스냅샷으로 함께 저장하고, 사용자가 환산 원화값을 직접 덮어쓸 수 있습니다(카드 명세서 반영). 외화 고정지출은 매달 결제일 환율로 재환산됩니다. `fx.enabled=false`여도 폴백 환율로 기능은 동작하며, 이때 값은 "추정"으로 표시됩니다.
- **소셜 로그인(카카오)**: 키 미설정 시 동작하지 않습니다.
- 그룹 가계부·챌린지·뱃지·실시간 알림은 이 버전에 없습니다(팀 프로젝트에만 존재).

## 다음 단계

- 실제 사용자 인터뷰로 AI 코칭 넛지 문구/타이밍 검증
- 성장 리포트에 카테고리별 지출 추이 차트 보강
