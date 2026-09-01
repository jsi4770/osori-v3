const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconHome = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5a1 1 0 0 0 1 1H9.5v-6h5v6H17.5a1 1 0 0 0 1-1V10" />
  </svg>
);

export const IconCalendar = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3v4M16 3v4" />
  </svg>
);

export const IconPin = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

export const IconTrendingUp = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M3.5 16.5 9.5 10.5 13.5 14.5 20.5 6.5" />
    <path d="M14.5 6.5h6v6" />
  </svg>
);

// 채워진 단일 path 기어(머티리얼 스타일) — 작은 크기에서도 확실히 기어로 읽힌다.
// 속성을 spread 없이 직접 지정해 렌더 이슈 가능성을 없앤다.
export const IconSettings = ({ size = 20, color = "currentColor", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
    {...props}
  >
    <path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.29.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.24.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
  </svg>
);

export const IconUser = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
  </svg>
);

export const IconReceipt = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M6 3.5h12v17l-2.5-1.6L13 20.5l-2.5-1.6L8 20.5l-2-1.3V3.5Z" />
    <path d="M9 8h6M9 11.5h6M9 15h4" />
  </svg>
);

export const IconCheck = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
);

export const IconSkip = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M5 6v12l8-6-8-6Z" />
    <path d="M17 6v12" />
  </svg>
);

export const IconClock = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconSparkle = ({ size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M12 3.5c.7 3.4 1.6 4.3 5 5-3.4.7-4.3 1.6-5 5-.7-3.4-1.6-4.3-5-5 3.4-.7 4.3-1.6 5-5Z" />
    <path d="M18.5 13.5c.35 1.6.9 2.15 2.5 2.5-1.6.35-2.15.9-2.5 2.5-.35-1.6-.9-2.15-2.5-2.5 1.6-.35 2.15-.9 2.5-2.5Z" />
  </svg>
);

export const IconBolt = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
    <path d="M13 3 5 13.5h6L11 21l8-10.5h-6L13 3Z" />
  </svg>
);

export const IconArrowUp = ({ size = 20, color = "currentColor", strokeWidth = 2.75, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 22V4" />
    <path d="M3.5 12.5 12 4l8.5 8.5" />
  </svg>
);
