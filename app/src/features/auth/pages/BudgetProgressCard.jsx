import "./BudgetProgressCard.css";

// 설정 탭에서 예산/저축 목표를 등록해야만 나타난다(둘 다 비어있으면 아예 렌더링하지 않음).
function BudgetProgressCard({ user, monthlySpent }) {
  const monthlyBudget = Number(user?.bamount) || 0;
  const savingsGoalAmount = Number(user?.savingsGoalAmount) || 0;
  const savingsCurrentAmount = Number(user?.savingsCurrentAmount) || 0;
  const savingsGoalDate = user?.savingsGoalDate;
  const autoFill = user?.savingsAutoFill === "Y";

  if (!monthlyBudget && !savingsGoalAmount) return null;

  const budgetPct = monthlyBudget > 0 ? (monthlySpent / monthlyBudget) * 100 : 0;
  const budgetOver = monthlyBudget > 0 && monthlySpent > monthlyBudget;

  const savingsPct = savingsGoalAmount > 0 ? Math.min((savingsCurrentAmount / savingsGoalAmount) * 100, 100) : 0;

  const dDay = (() => {
    if (!savingsGoalDate) return null;
    const target = new Date(savingsGoalDate);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  })();

  // "남은 예산 자동 저축"이 켜져 있을 때, 이번 달이 이대로 끝나면 다음 달에 적립될 예상액 (저장 X, 표시만)
  const goalActive = savingsGoalAmount > 0 && (dDay == null || dDay >= 0);
  const projectedSaving =
    autoFill && goalActive && monthlyBudget > 0
      ? Math.min(
          Math.max(0, monthlyBudget - monthlySpent),
          Math.max(0, savingsGoalAmount - savingsCurrentAmount)
        )
      : 0;

  return (
    <div className="bp-wrap">
      {monthlyBudget > 0 && (
        <div className="bp-row">
          <div className="bp-row-head">
            <span className="bp-row-label">월 예산</span>
            <span className={`bp-row-value ${budgetOver ? "bp-over" : ""}`}>
              {monthlySpent.toLocaleString()} / {monthlyBudget.toLocaleString()}원
            </span>
          </div>
          <div className="bp-bar-track">
            <div
              className={`bp-bar-fill ${budgetOver ? "bp-over" : ""}`}
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          {budgetOver && (
            <div className="bp-warning">예산을 {(monthlySpent - monthlyBudget).toLocaleString()}원 초과했어요</div>
          )}
        </div>
      )}

      {savingsGoalAmount > 0 && (
        <div className="bp-row">
          <div className="bp-row-head">
            <span className="bp-row-label">
              저축 목표
              {dDay != null && (dDay >= 0 ? ` · D-${dDay}` : " · 목표일 지남")}
            </span>
            <span className="bp-row-value">
              {savingsCurrentAmount.toLocaleString()} / {savingsGoalAmount.toLocaleString()}원
            </span>
          </div>
          <div className="bp-bar-track">
            <div className="bp-bar-fill bp-savings" style={{ width: `${savingsPct}%` }} />
          </div>
          {projectedSaving > 0 && (
            <div className="bp-projected">
              이번 달 이대로면 다음 달에 <b>+{projectedSaving.toLocaleString()}원</b> 자동 저축돼요
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BudgetProgressCard;
