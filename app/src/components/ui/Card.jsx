import "./Card.css";

/**
 * 공용 카드 컨테이너.
 * @param {'flat'|'raised'} [elevation]  그림자 강도(기본: shadow-2)
 * @param {boolean} [lg=false]   큰 카드(홈 요약 등) — 더 큰 radius/padding
 * @param {boolean} [padSm=false] 좁은 패딩
 */
export default function Card({
  elevation,
  lg = false,
  padSm = false,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    "ui-card",
    elevation && `ui-card--${elevation}`,
    lg && "ui-card--lg",
    padSm && "ui-card--pad-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
