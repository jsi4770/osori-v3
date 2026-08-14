import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconReceipt, IconTrendingUp, IconCalendar, IconCheck } from "../../components/icons";
import { useAppReady } from "../../context/AppReadyContext";
import { useAuth } from "../../context/AuthContext";
import { useFeedback } from "../../context/FeedbackContext";
import { authApi } from "../../api/authApi";
import "./OnboardingPage.css";

const BADGER = "/osori-badger.webp";
const BADGER_MONEY = "/osori-badger-money.webp";

// 카카오 로그인 URL — 로그인 페이지와 동일 규격 유지
const REST_API_KEY = "0a83fd7608e0074b1c448e2add1f2632";
const REDIRECT_URI = `${window.location.origin}/auth/kakao/callback`;
const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&prompt=login`;

// 슬라이드 데이터 — 활성 단계(currentStep)에 따라 렌더링
const SLIDES_DATA = [
  {
    key: "intro",
    badge: "OSORI · 오늘의 소비 리포트",
    title: (
      <>
        오늘의 소비 리포트,
        <br />
        <b>오소리</b>
      </>
    ),
    copy: "야무진 오소리와 함께\n영리한 소비 습관을 만들어봐요.",
    visual: "intro",
  },
  {
    key: "ai",
    badge: "Gemini AI 분석",
    title: (
      <>
        <b>Gemini</b>가 분석하는
        <br />
        나만의 맞춤 리포트
      </>
    ),
    copy: "단순 통계는 그만!\n구글 Gemini가 소비 패턴을 분석해\n잔소리와 꿀팁이 담긴 '오늘의 한 줄 평'을 배달해요.",
    visual: "ai",
  },
  {
    key: "quickInput",
    badge: "AI 빠른 입력",
    title: (
      <>
        카테고리 고민은 그만,
        <br />
        <b>말하듯 입력</b>하세요
      </>
    ),
    copy: "이걸 뭐라고 분류해야 하지? 그 고민은 이제 끝.\n문장 한 줄이면 AI가 금액·카테고리를 알아서 채워주고,\n쓰면 쓸수록 내 소비 습관에 맞게 더 똑똑해져요.",
    visual: "quickInput",
  },
  {
    key: "fixed",
    badge: "고정지출 관리",
    title: (
      <>
        새는 돈 없이 <b>철저하게</b>
      </>
    ),
    copy: "매달 나가는 구독료·공과금 등\n고정지출을 한눈에 파악하고\n깔끔하게 지출 계획을 세워보세요.",
    visual: "fixed",
  },
  {
    key: "start",
    badge: "준비 완료",
    title: (
      <>
        준비되셨나요?
        <br />
        이제 소비를 <b>사냥할 시간!</b>
      </>
    ),
    copy: "오소리와 함께 오늘의 소비를 기록해봐요.",
    visual: "start",
  },
];

/* ---------- 슬라이드별 비주얼 (CSS 일러스트) ---------- */

function IntroVisual() {
  return (
    <div className="ob-visual ob-intro">
      <span className="ob-coin ob-coin-1">🪙</span>
      <span className="ob-coin ob-coin-2">💰</span>
      <span className="ob-coin ob-coin-3">🔍</span>
      <div className="ob-badger-halo" />
      <img src={BADGER} alt="오소리 캐릭터" className="ob-badger" />
    </div>
  );
}

function QuickInputVisual() {
  return (
    <div className="ob-visual">
      <div className="ob-phone">
        <div className="ob-input-mock">
          <span className="ob-input-mock-text">다이소에서 생활용품 8000원</span>
        </div>
        <div className="ob-parse-arrow">↓</div>
        <div className="ob-parse-fields">
          <div className="ob-chip"><span>금액</span><b>8,000원</b></div>
          <div className="ob-chip"><span>카테고리</span><b>생활/마트 ✓</b></div>
          <div className="ob-chip ob-chip-full"><span>추천</span><b>자주 쓰는 카테고리로 자동 분류</b></div>
        </div>
      </div>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="ob-visual ob-ai">
      <img src={BADGER} alt="오소리 코치" className="ob-badger ob-badger-sm" />
      <div className="ob-bubble ob-bubble-1">
        이번 주 배달비가 지난달보다 <b>40%</b> 늘었어요 🍗
      </div>
      <div className="ob-bubble ob-bubble-2">
        주말 한 끼만 집밥으로 바꿔볼까요? <b>약 2만 원</b> 아껴요 💪
      </div>
      <div className="ob-bubble ob-bubble-ai">
        <span className="ob-ai-tag">✦ 오늘의 한 줄 평</span>
        충동구매 없는 하루, 아주 잘하고 있어요!
      </div>
    </div>
  );
}

function FixedVisual() {
  const items = [
    { icon: "🎬", name: "넷플릭스", price: "13,500원", day: "매월 5일" },
    { icon: "🎵", name: "멜론", price: "10,900원", day: "매월 12일" },
    { icon: "📱", name: "통신비", price: "45,000원", day: "매월 25일" },
  ];
  return (
    <div className="ob-visual">
      <div className="ob-dash">
        <div className="ob-dash-head">
          <div>
            <p className="ob-dash-label">이번 달 고정지출</p>
            <p className="ob-dash-total">69,400원</p>
          </div>
          <div className="ob-dash-badge"><IconCalendar size={20} /></div>
        </div>
        {items.map((it) => (
          <div className="ob-sub-row" key={it.name}>
            <span className="ob-sub-icon">{it.icon}</span>
            <div className="ob-sub-meta">
              <b>{it.name}</b>
              <span>{it.day}</span>
            </div>
            <span className="ob-sub-price">{it.price}</span>
          </div>
        ))}
        <div className="ob-dash-foot"><IconCheck size={16} /> 새는 돈 없이 관리 중</div>
      </div>
    </div>
  );
}

function StartVisual() {
  return (
    <div className="ob-visual ob-start">
      <div className="ob-badger-halo" />
      <img src={BADGER_MONEY} alt="환영하는 오소리" className="ob-badger ob-badger-money" />
    </div>
  );
}

function SlideVisual({ type }) {
  switch (type) {
    case "intro": return <IntroVisual />;
    case "quickInput": return <QuickInputVisual />;
    case "ai": return <AiVisual />;
    case "fixed": return <FixedVisual />;
    case "start": return <StartVisual />;
    default: return null;
  }
}

/* ---------- 메인 ---------- */

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { markReady } = useAppReady();
  const { login } = useAuth();
  const { toast } = useFeedback();
  const [currentStep, setCurrentStep] = useState(0);
  const [guestLoading, setGuestLoading] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // 온보딩도 기다릴 데이터가 없으므로 마운트 즉시 스플래시에 "준비됐다"고 알린다.
  useEffect(() => { markReady(); }, [markReady]);

  const isLast = currentStep === SLIDES_DATA.length - 1;
  const slide = SLIDES_DATA[currentStep];

  const finish = (dest) => {
    localStorage.setItem("osori_onboarded", "true");
    if (dest === "kakao") {
      window.location.href = KAKAO_AUTH_URL;
      return;
    }
    navigate(dest, { replace: true });
  };

  // 리뷰어가 회원가입 없이 바로 둘러볼 수 있도록, 미리 목업 데이터를 채워둔 게스트 계정(osori100)으로 즉시 로그인
  const handleGuestLogin = async () => {
    if (guestLoading) return;
    setGuestLoading(true);
    try {
      const res = await authApi.guestLogin();
      login(res);
      localStorage.setItem("osori_onboarded", "true");
      navigate("/mypage/assets", { replace: true });
    } catch (error) {
      toast("게스트 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.", { type: "error" });
    } finally {
      setGuestLoading(false);
    }
  };

  const goNext = () => {
    if (isLast) return;
    setCurrentStep((s) => Math.min(s + 1, SLIDES_DATA.length - 1));
  };
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  // 순수 터치 스와이프 (가로 스와이프만 인식, 세로 스크롤 오인식 방지)
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="ob-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="ob-topbar" />

      {/* key로 단계 전환 시 fade-in-up 애니메이션 재생 */}
      <div className="ob-stage" key={slide.key}>
        <SlideVisual type={slide.visual} />

        <div className="ob-text">
          <span className="ob-badge">{slide.badge}</span>
          <h1 className="ob-title">{slide.title}</h1>
          <p className="ob-copy">{slide.copy}</p>
        </div>
      </div>

      <div className="ob-footer">
        <div className="ob-dots">
          {SLIDES_DATA.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`ob-dot ${i === currentStep ? "active" : ""}`}
              aria-label={`${i + 1}번째 슬라이드`}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>

        {isLast ? (
          <div className="ob-cta">
            <button type="button" className="ob-btn ob-btn-guest" onClick={handleGuestLogin} disabled={guestLoading}>
              {guestLoading ? "접속 중..." : "게스트로 바로 로그인하기"}
            </button>
            <button type="button" className="ob-btn ob-btn-kakao" onClick={() => finish("kakao")}>
              <KakaoGlyph />
              카카오로 3초 만에 시작하기
            </button>
            <button type="button" className="ob-btn ob-btn-email" onClick={() => finish("/register")}>
              이메일로 가입 / 로그인
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="ob-btn ob-btn-next" onClick={goNext}>
              다음
            </button>
            <button
              type="button"
              className="ob-skip ob-skip-footer"
              onClick={() => setCurrentStep(SLIDES_DATA.length - 1)}
            >
              건너뛰기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function KakaoGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3C6.477 3 2 6.58 2 11c0 2.84 1.86 5.34 4.65 6.77-.2.72-.73 2.6-.84 3.02-.1.38.14.38.3.27.13-.09 2.1-1.43 2.95-2.02.62.09 1.26.14 1.94.14 5.523 0 10-3.58 10-8S17.523 3 12 3z" />
    </svg>
  );
}
