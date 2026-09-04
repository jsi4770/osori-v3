import "./Button.css";

/**
 * 공용 버튼.
 *
 * @param {'primary'|'secondary'|'ghost'|'danger'|'danger-soft'} [variant='primary']
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {boolean} [pill=false]   알약형(라운드 대신 완전 둥근 모서리)
 * @param {boolean} [block=false]  가로 꽉 채움
 * @param {boolean} [loading=false] 스피너 표시 + 비활성
 * 나머지 props(type, onClick, disabled, aria-* 등)는 <button>에 그대로 전달.
 */
export default function Button({
  variant = "primary",
  size = "md",
  pill = false,
  block = false,
  loading = false,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const classes = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    pill && "ui-btn--pill",
    block && "ui-btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
