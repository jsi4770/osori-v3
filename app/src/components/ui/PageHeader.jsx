import "./PageHeader.css";

/**
 * 공용 페이지 상단 헤더(제목 + 부제 + 우측 액션).
 * @param {string} title
 * @param {React.ReactNode} [subtitle]
 * @param {React.ReactNode} [actions]  제목 우측에 붙는 버튼/아이콘 영역
 */
export default function PageHeader({ title, subtitle, actions, className = "", ...rest }) {
  return (
    <header className={`ui-page-header ${className}`.trim()} {...rest}>
      <div className="ui-page-header__row">
        <h2 className="ui-page-header__title">{title}</h2>
        {actions}
      </div>
      {subtitle != null && <p className="ui-page-header__sub">{subtitle}</p>}
    </header>
  );
}
