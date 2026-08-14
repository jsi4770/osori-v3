-- fincoach schema (H2, MODE=Oracle) — generated to match the columns referenced in mappers/*.xml
-- All statements are idempotent (IF NOT EXISTS) so spring.sql.init.mode=always is safe to re-run on every startup.

CREATE SEQUENCE IF NOT EXISTS SEQ_USERS_ID START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS SEQ_MYTRANS START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS SEQ_FNO START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS USERS (
    USER_ID     INT PRIMARY KEY,
    LOGIN_ID    VARCHAR(100) NOT NULL UNIQUE,
    USER_NAME   VARCHAR(100),
    NICKNAME    VARCHAR(100) UNIQUE,
    EMAIL       VARCHAR(200) UNIQUE,
    PASSWORD    VARCHAR(200),
    STATUS      VARCHAR(1) DEFAULT 'Y',
    LAST_LOGIN  DATE,
    CREATED_AT  DATE DEFAULT CURRENT_DATE,
    B_AMOUNT    INT,
    RESET_DATE  INT,
    LOGIN_COUNT INT DEFAULT 0,
    LOCK_UNTIL  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AUTH_ACCOUNT (
    USER_ID          INT PRIMARY KEY REFERENCES USERS(USER_ID),
    LOGIN_TYPE       VARCHAR(20),
    PROVIDER_USER_ID VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS FIXEDTRANS (
    FIXED_ID   INT PRIMARY KEY,
    NAME       VARCHAR(200),
    TRANS_DATE DATE,
    AMOUNT     INT,
    CATEGORY   VARCHAR(50),
    PAY_DAY    INT,
    USER_ID    INT REFERENCES USERS(USER_ID)
);

CREATE TABLE IF NOT EXISTS MYTRANS (
    TRAN_ID          INT PRIMARY KEY,
    TITLE            VARCHAR(200),
    TRANS_DATE       DATE,
    ORIGINAL_AMOUNT  INT,
    IS_SHARED        VARCHAR(1) DEFAULT 'N',
    CATEGORY         VARCHAR(50),
    TYPE             VARCHAR(3),
    MEMO             VARCHAR(500),
    USER_ID          INT REFERENCES USERS(USER_ID),
    GROUPB_ID        INT,
    FIXED_ID         INT,
    EXCLUDE_ANALYSIS VARCHAR(1) DEFAULT 'N'
);

-- CREATE TABLE IF NOT EXISTS는 이미 존재하는 테이블(로컬/배포 DB)엔 새 컬럼을 반영하지 않으므로,
-- 기존 테이블에도 안전하게(멱등적으로) 컬럼을 추가하기 위한 보강 구문.
ALTER TABLE MYTRANS ADD COLUMN IF NOT EXISTS EXCLUDE_ANALYSIS VARCHAR(1) DEFAULT 'N';

CREATE SEQUENCE IF NOT EXISTS SEQ_COACHING START WITH 1 INCREMENT BY 1;

-- AI coaching: nudges (ROLE='NUDGE') and the chat thread that follows one (ROLE='USER'/'COACH').
-- THREAD_ID on a NUDGE row equals its own MESSAGE_ID; replies reference that same THREAD_ID.
CREATE TABLE IF NOT EXISTS COACHING_MESSAGE (
    MESSAGE_ID      INT PRIMARY KEY,
    USER_ID         INT REFERENCES USERS(USER_ID),
    THREAD_ID       INT NOT NULL,
    ROLE            VARCHAR(10) NOT NULL,
    CONTENT         VARCHAR(2000),
    CATEGORY        VARCHAR(50),
    ORIGINAL_AMOUNT INT,
    AVG_AMOUNT      INT,
    ACCEPTED        VARCHAR(1),
    CREATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS SEQ_TREND START WITH 1 INCREMENT BY 1;

-- AI coaching: monthly macro spending-trend analysis, cached per (user, year-month)
-- so Gemini is called at most once per user per month regardless of how many times
-- the growth report is opened that month.
CREATE TABLE IF NOT EXISTS SPENDING_TREND (
    TREND_ID    INT PRIMARY KEY,
    USER_ID     INT REFERENCES USERS(USER_ID),
    YEAR_MONTH  VARCHAR(7) NOT NULL,
    CONTENT     VARCHAR(2000),
    CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (USER_ID, YEAR_MONTH)
);

CREATE SEQUENCE IF NOT EXISTS SEQ_CHALLENGE START WITH 1 INCREMENT BY 1;

-- AI 코칭 채팅에서 사용자가 동의한 구체적 실행 목표(챌린지). 진행률/성공 여부는 저장하지 않고
-- 매번 실제 거래 데이터(MYTRANS)로 프론트에서 실시간 계산한다 — 배치/크론이 필요 없다.
CREATE TABLE IF NOT EXISTS CHALLENGE (
    CHALLENGE_ID  INT PRIMARY KEY,
    USER_ID       INT REFERENCES USERS(USER_ID),
    THREAD_ID     INT,
    CATEGORY      VARCHAR(50),
    TITLE         VARCHAR(200),
    METRIC_TYPE   VARCHAR(10) NOT NULL,
    TARGET_VALUE  INT NOT NULL,
    START_DATE    DATE NOT NULL,
    END_DATE      DATE NOT NULL,
    CREATED_AT    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS SEQ_MERCHANT_CACHE START WITH 1 INCREMENT BY 1;

-- 자연어 지출 입력 파싱: 사용자가 같은 가맹점명을 반복 입력하면 merchant -> category 매핑을
-- 사용자별로 학습해, 다음번엔 LLM의 category 추측보다 이 캐시를 우선한다(신뢰도도 함께 올림).
-- MERCHANT는 트림/소문자 정규화한 값으로 저장해 사소한 표기 차이(대소문자, 앞뒤 공백)를 흡수한다.
CREATE TABLE IF NOT EXISTS MERCHANT_CATEGORY_CACHE (
    CACHE_ID    INT PRIMARY KEY,
    USER_ID     INT REFERENCES USERS(USER_ID),
    MERCHANT    VARCHAR(200) NOT NULL,
    CATEGORY    VARCHAR(50) NOT NULL,
    HIT_COUNT   INT DEFAULT 1,
    UPDATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (USER_ID, MERCHANT)
);

CREATE SEQUENCE IF NOT EXISTS SEQ_NL_INPUT_HISTORY START WITH 1 INCREMENT BY 1;

-- 자연어 빠른 입력창 아래 예시 칩을 사용자별로 개인화하기 위한 입력 이력. 같은 문장을
-- 그대로 다시 입력하면 USE_COUNT가 늘고, 예시는 (USE_COUNT desc, UPDATED_AT desc)로 뽑는다
-- — 정확히 반복되는 문장은 드물어서 자연스럽게 "최근에 쓴 문장 위주"로도 동작한다.
CREATE TABLE IF NOT EXISTS NL_INPUT_HISTORY (
    HISTORY_ID  INT PRIMARY KEY,
    USER_ID     INT REFERENCES USERS(USER_ID),
    TYPE        VARCHAR(3) NOT NULL DEFAULT 'OUT',
    INPUT_TEXT  VARCHAR(200) NOT NULL,
    USE_COUNT   INT DEFAULT 1,
    UPDATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (USER_ID, TYPE, INPUT_TEXT)
);

CREATE SEQUENCE IF NOT EXISTS SEQ_INSTALLMENT_PLAN START WITH 1 INCREMENT BY 1;

-- 할부 지출: 최초 입력 시점에 N개월치 MYTRANS 행을 한 번에 미리 생성해두고(FixedTrans처럼
-- 스케줄러로 매일 생성하는 방식이 아님), 각 행이 어느 할부 계획에서 나왔는지만 여기 기록한다.
-- 캘린더는 MYTRANS.INSTALLMENT_ID가 있고 TRANS_DATE가 오늘 이후인 행을 "예정"(회색)으로 표시한다.
CREATE TABLE IF NOT EXISTS INSTALLMENT_PLAN (
    PLAN_ID             INT PRIMARY KEY,
    USER_ID             INT REFERENCES USERS(USER_ID),
    TITLE               VARCHAR(200),
    TOTAL_AMOUNT        INT NOT NULL,
    INSTALLMENT_MONTHS  INT NOT NULL,
    START_DATE          DATE NOT NULL,
    CATEGORY            VARCHAR(50),
    MEMO                VARCHAR(500),
    CREATED_AT          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MYTRANS 행이 할부 계획에서 생성됐다면 그 계획을 가리킨다 (FIXED_ID와 동일한 패턴, FK 제약 없음).
ALTER TABLE MYTRANS ADD COLUMN IF NOT EXISTS INSTALLMENT_ID INT;

-- 실제 Gemini 호출이 일어나는 모든 엔드포인트(nlparse/coaching/challenge)가 공유하는 일일 호출 한도 카운터.
-- 예전엔 서버 메모리(AtomicInteger)에만 있어서 배포/헬스체크 재시작마다 한도가 리셋됐다 — DB에 저장해
-- 재시작과 무관하게 유지되도록 한다. CALL_DATE가 PK라 날짜당 한 행만 존재하고, 증가는 항상
-- INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING으로 원자적으로 처리한다(동시 요청에도 안전).
CREATE TABLE IF NOT EXISTS GEMINI_CALL_BUDGET (
    CALL_DATE  DATE PRIMARY KEY,
    CALL_COUNT INT NOT NULL DEFAULT 0
);

-- 저축 목표. B_AMOUNT(기존 컬럼, 예전부터 있었지만 어디서도 안 쓰이고 있었음)를 "월 예산"으로 재사용한다.
-- 저축은 이 앱이 잔액을 추적하지 않아 지출입에서 자동 계산할 수 없으므로, 목표 금액/날짜와 함께
-- 사용자가 직접 입력·갱신하는 SAVINGS_CURRENT_AMOUNT로 진행률을 계산한다.
ALTER TABLE USERS ADD COLUMN IF NOT EXISTS SAVINGS_GOAL_AMOUNT INT;
ALTER TABLE USERS ADD COLUMN IF NOT EXISTS SAVINGS_GOAL_DATE DATE;
ALTER TABLE USERS ADD COLUMN IF NOT EXISTS SAVINGS_CURRENT_AMOUNT INT DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS SEQ_USER_CATEGORY START WITH 1 INCREMENT BY 1;

-- 카테고리 개인화: 기본 카테고리 목록(app/src/constants/categories.js와 NlExpenseParseServiceImpl에
-- 동일하게 하드코딩됨)은 그대로 두고, 사용자별로 "추가한 커스텀 카테고리"와 "숨긴 기본 카테고리"만
-- 이 테이블에 기록한다. SOURCE='CUSTOM'이면 NAME이 새로 추가된 카테고리, SOURCE='HIDDEN_DEFAULT'면
-- NAME이 이 사용자에게는 숨겨야 할 기본 카테고리 이름이다. MYTRANS.CATEGORY는 이미 자유 텍스트라서
-- 커스텀 카테고리를 삭제해도 기존 거래 내역의 카테고리 값은 그대로 남는다(선택 목록에서만 빠짐).
CREATE TABLE IF NOT EXISTS USER_CATEGORY (
    CATEGORY_ID INT PRIMARY KEY,
    USER_ID     INT REFERENCES USERS(USER_ID),
    TYPE        VARCHAR(3) NOT NULL,
    NAME        VARCHAR(50) NOT NULL,
    SOURCE      VARCHAR(20) NOT NULL,
    CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (USER_ID, TYPE, NAME)
);
