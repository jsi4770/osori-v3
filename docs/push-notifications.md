# 푸시 알림 (PWA Web Push)

OSORI는 PWA Web Push로 4가지 알림을 보낸다.

| 알림 | 트리거 | 전달 방식 |
|---|---|---|
| 소비 코치 넛지 | 새 넛지(NUDGE) 생성 시 (`CoachingServiceImpl`) | 서버 푸시 |
| 예산 초과 경고 | 이번 달 지출 > 월 예산(`USERS.B_AMOUNT`) | 앱 사용 중이면 로컬 알림(즉시), 백그라운드면 서버가 **매일 20:00(KST)** 체크 후 푸시 (달마다 1회) |
| 고정지출 결제 예정 | `FIXEDTRANS.PAY_DAY` == 내일 | 서버 푸시, **매일 09:00(KST)** |
| 오늘의 소비 리포트 리마인더 | 매일 | 서버 푸시, **매일 21:00(KST)** 고정 |

크론은 `server/.../config/PushSchedulerConfig.java`, 발송기는 `push/model/service/PushNotificationService.java`.

## 서버 설정 (Railway 환경변수)

VAPID 키 생성:

```bash
npx web-push generate-vapid-keys
```

Railway 프로젝트에 아래 환경변수를 추가한다:

| 변수 | 값 |
|---|---|
| `WEBPUSH_ENABLED` | `true` |
| `WEBPUSH_VAPID_PUBLIC` | 생성된 publicKey |
| `WEBPUSH_VAPID_PRIVATE` | 생성된 privateKey |
| `WEBPUSH_VAPID_SUBJECT` | `mailto:chosi4770@gmail.com` |

- 미설정 시 `webpush.enabled=false`로 동작 → 구독 API(`/push/*`)는 살아있지만 발송은 조용히 스킵.
- 로컬 개발용 키는 `application-local.properties`(git-ignored)에 이미 넣어둠. `SPRING_PROFILES_ACTIVE=local`로 실행하면 켜진다.
- `application.properties` / `.example`은 `CHANGE_ME` 플레이스홀더만 커밋한다.

## 프론트엔드

- 별도 환경변수 없음. VAPID 공개키는 `GET /fincoach/push/vapidPublicKey`로 받아온다.
- 서비스워커: `app/src/sw.js` (vite-plugin-pwa `injectManifest` 모드). `push` / `notificationclick` 처리.
- 구독 로직: `app/src/push/pushClient.js`, 훅: `app/src/hooks/usePushNotifications.js`.
- 사용자는 **프로필 설정 → 알림 → 푸시 알림** 토글로 켠다(권한 요청 + 구독 등록).

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/fincoach/push/vapidPublicKey` | `{ publicKey }` |
| POST | `/fincoach/push/subscribe` | body: `{ userId, subscription }` (subscription은 브라우저 `PushSubscription.toJSON()`) |
| POST | `/fincoach/push/unsubscribe` | body: `{ endpoint }` |

죽은 구독(발송 응답 404/410)은 자동으로 `PUSH_SUBSCRIPTION`에서 삭제된다.

## 플랫폼 주의사항

- **Android (Chrome/삼성인터넷)**: 앱 종료 상태에서도 정상 수신.
- **iOS/iPadOS**: **홈 화면에 "추가"한 PWA + iOS 16.4 이상**에서만 동작. 사파리 탭 상태에서는 불가.
  권한 요청도 사용자 탭 제스처 안에서 호출해야 함 → 설정 화면의 토글 버튼으로 처리. 프론트에서
  `isIosSafari() && !isStandalone()`이면 "홈 화면에 추가 후 사용" 안내를 띄운다.
- **데스크톱 Chrome/Edge/Firefox**: 정상.

## 로컬 테스트

1. Postgres 실행 → `cd server && SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run`
2. `cd app && npm run build && npm run preview` (SW는 프로덕션 빌드에서만 동작 — `devOptions.enabled=false`)
3. `http://localhost:4173` 접속 → 로그인 → 프로필 설정 → 알림 토글 ON → 권한 허용
4. 브라우저 DevTools → Application → Service Workers → "Push" 버튼으로 아래 JSON을 넣어 표시 확인:
   ```json
   {"title":"소비 코치","body":"테스트 알림","url":"/mypage/assets","tag":"test"}
   ```
5. 실제 서버 발송 확인: 넛지 생성(홈 화면에서 이상 소비 감지) 또는 크론 시각에 발송 로그(`[webpush]`) 확인.

## 홈 화면 아이콘 길게 누르기 → 빠른 입력 (위젯 대체)

`manifest.shortcuts`로 3개 등록 (`app/vite.config.js`):

- **빠른 지출 입력** → `/mypage/expenseForm?quick=1` (NL 입력창 autofocus)
- **빠른 수입 입력** → `/mypage/expenseForm?quick=1&type=IN` (수입 모드로 시작)
- **오늘의 소비 리포트** → `/mypage/coaching/report`

Android는 아이콘 롱프레스, iOS는 16.4+ 설치 PWA에서 롱프레스로 노출된다.
