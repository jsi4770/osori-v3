import "./BudgetProgressCard.css";

// 월 예산을 설정하면 홈 화면에 "이번 달 쓸 수 있는 금액(잔액)"을 보여준다.
// (이번 달 지출 금액은 상단에 크게 따로 표시되므로 여기서는 중복 표기하지 않는다.)
function BudgetProgressCard({ user, monthlySpent }) {
  const monthlyBudget = Number(user?.bamount) || 0;
  if (!monthlyBudget) return null;

  const remaining = monthlyBudget - monthlySpent;
  const over = remaining < 0;
  const usedPct = Math.min(Math.max((monthlySpent / monthlyBudget) * 100, 0), 100);

  return (
    <div className="bp-wrap">
      <div className="bp-row">
        <div className="bp-row-head">
          <span className="bp-row-label">{over ? "예산 초과" : "이번 달 쓸 수 있는 금액"}</span>
          <span className={`bp-row-value ${over ? "bp-over" : ""}`}>
            {over ? "-" : ""}
            {Math.abs(remaining).toLocaleString()}원
          </span>
        </div>
        <div className="bp-bar-track">
          <div className={`bp-bar-fill ${over ? "bp-over" : ""}`} style={{ width: `${usedPct}%` }} />
        </div>
        <div className="bp-sub">월 예산 {monthlyBudget.toLocaleString()}원</div>
      </div>
    </div>
  );
}

export default BudgetProgressCard;
