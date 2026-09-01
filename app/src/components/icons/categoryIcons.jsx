// 카테고리 타일용 벡터 아이콘. components/icons/index.jsx와 같은 스타일
// (24 viewBox, currentColor stroke 1.8). 이모지 대신 사용한다.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const S = ({ size = 22, children, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    {children}
  </svg>
);

export const CatFood = (p) => (
  <S {...p}>
    <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z" />
    <path d="M12 11V8" />
    <path d="M8.5 4.5c-.6 1 .6 2 0 3M15.5 4.5c-.6 1 .6 2 0 3" />
  </S>
);

export const CatCart = (p) => (
  <S {...p}>
    <path d="M3 4h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21 7H6" />
    <circle cx="9.5" cy="20" r="1.3" />
    <circle cx="17.5" cy="20" r="1.3" />
  </S>
);

export const CatBag = (p) => (
  <S {...p}>
    <path d="M6 8h12l1 12H5L6 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </S>
);

export const CatHealth = (p) => (
  <S {...p}>
    <path d="M12 20S4 14.5 4 9a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 5.5-8 11-8 11Z" />
    <path d="M7 12h2l1.5-2.5L13 15l1.4-3H17" />
  </S>
);

export const CatBus = (p) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="14" rx="2.5" />
    <path d="M4 12h16M8 18v2M16 18v2" />
    <circle cx="8" cy="15" r="1" />
    <circle cx="16" cy="15" r="1" />
  </S>
);

export const CatTicket = (p) => (
  <S {...p}>
    <path d="M4 8a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 8v1.5a2 2 0 0 0 0 5V16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-1.5a2 2 0 0 0 0-5Z" />
    <path d="M14 6.5v11" />
  </S>
);

export const CatBook = (p) => (
  <S {...p}>
    <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
    <path d="M6.5 10.5V15c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.5" />
    <path d="M21.5 8.5v5" />
  </S>
);

export const CatHouse = (p) => (
  <S {...p}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.5" />
  </S>
);

export const CatSignal = (p) => (
  <S {...p}>
    <path d="M4 20h.01M8 20v-3M12 20v-6M16 20v-9M20 20V6" />
  </S>
);

export const CatShield = (p) => (
  <S {...p}>
    <path d="M12 3.5 19 6v6c0 4.5-3 7-7 8.5C8 19 5 16.5 5 12V6l7-2.5Z" />
    <path d="M9 12l2 2 4-4.5" />
  </S>
);

export const CatRepeat = (p) => (
  <S {...p}>
    <path d="M4 9a7 7 0 0 1 12-4l2 2" />
    <path d="M18 3v4h-4" />
    <path d="M20 15a7 7 0 0 1-12 4l-2-2" />
    <path d="M6 21v-4h4" />
  </S>
);

export const CatBriefcase = (p) => (
  <S {...p}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
    <path d="M3.5 13h17" />
  </S>
);

export const CatGift = (p) => (
  <S {...p}>
    <rect x="4" y="9" width="16" height="11" rx="1.5" />
    <path d="M3 9h18M12 9v11" />
    <path d="M12 9S9.5 4 7.5 5.5 10 9 12 9ZM12 9s2.5-5 4.5-3.5S14 9 12 9Z" />
  </S>
);

export const CatChart = (p) => (
  <S {...p}>
    <path d="M4 19V5M4 19h16" />
    <path d="M8 15l3.5-4 3 2.5L20 7" />
  </S>
);

export const CatStar = (p) => (
  <S {...p}>
    <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9l2-5.5Z" />
  </S>
);

export const CatTag = (p) => (
  <S {...p}>
    <path d="M4 13V5.5A1.5 1.5 0 0 1 5.5 4H13l7 7-7.5 7.5L4 13Z" />
    <circle cx="8.5" cy="8.5" r="1.4" />
  </S>
);

const MAP = {
  "식비": CatFood,
  "생활/마트": CatCart,
  "쇼핑": CatBag,
  "의료/건강": CatHealth,
  "교통": CatBus,
  "문화/여가": CatTicket,
  "교육": CatBook,
  "주거/월세": CatHouse,
  "통신비": CatSignal,
  "보험": CatShield,
  "구독서비스": CatRepeat,
  "월급": CatBriefcase,
  "용돈": CatGift,
  "금융소득": CatChart,
  "상여금": CatStar,
  "기타": CatTag,
};

// 목록에 없는 커스텀 카테고리는 태그 아이콘으로 떨어진다.
export const CategoryIcon = ({ name, ...props }) => {
  const Icon = MAP[name] || CatTag;
  return <Icon {...props} />;
};
