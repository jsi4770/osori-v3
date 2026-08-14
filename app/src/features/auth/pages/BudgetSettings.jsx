import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useFeedback } from "../../../context/FeedbackContext";
import budgetApi from "../../../api/budgetApi";
import "./BudgetSettings.css";

// 설정 탭의 예산/저축 목표: 월 예산은 지출 대비 소모율을, 저축 목표는 목표금액 대비 현재
// 저축액을 홈 화면 진행률 카드에서 보여주는 데 쓰인다. 저축액은 이 앱이 잔액을 추적하지
// 않아 자동 계산이 불가능해서 사용자가 직접 입력·갱신한다.
function BudgetSettings() {
  const { user, setUser } = useAuth();
  const { toast } = useFeedback();

  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [savingsGoalAmount, setSavingsGoalAmount] = useState("");
  const [savingsGoalDate, setSavingsGoalDate] = useState("");
  const [savingsCurrentAmount, setSavingsCurrentAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setMonthlyBudget(user.bamount ? String(user.bamount) : "");
    setSavingsGoalAmount(user.savingsGoalAmount ? String(user.savingsGoalAmount) : "");
    setSavingsGoalDate(user.savingsGoalDate || "");
    setSavingsCurrentAmount(user.savingsCurrentAmount ? String(user.savingsCurrentAmount) : "");
  }, [user]);

  const handleSave = async () => {
    if (!user?.userId) return;

    setIsSaving(true);
    try {
      const res = await budgetApi.update({
        userId: user.userId,
        loginId: user.loginId,
        bamount: Number(monthlyBudget) || 0,
        savingsGoalAmount: Number(savingsGoalAmount) || 0,
        savingsGoalDate: savingsGoalDate || null,
        savingsCurrentAmount: Number(savingsCurrentAmount) || 0,
      });

      const updatedUser = res?.user || { ...user };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast(res?.message || "저장했습니다.", { type: "success" });
    } catch {
      toast("저장 중 오류가 발생했습니다.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="info-card ps-card bs-card">
      <div className="ps-theme-title">월 예산</div>
      <div className="ps-theme-desc">이번 달 쓸 수 있는 지출 한도를 설정하면 홈 화면에서 소모율을 볼 수 있어요.</div>
      <div className="ps-field bs-field">
        <div className="bs-amount-wrapper">
          <input
            className="ps-input"
            type="number"
            min="0"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            placeholder="예: 1500000"
          />
          <span className="bs-unit">원</span>
        </div>
      </div>

      <div className="ps-divider" />

      <div className="ps-theme-title">저축 목표</div>
      <div className="ps-theme-desc">목표 금액과 날짜, 지금까지 모은 금액을 입력하면 진행률을 보여드려요.</div>

      <div className="bs-form">
        <div className="ps-field">
          <label className="ps-label">목표 금액</label>
          <div className="bs-amount-wrapper">
            <input
              className="ps-input"
              type="number"
              min="0"
              value={savingsGoalAmount}
              onChange={(e) => setSavingsGoalAmount(e.target.value)}
              placeholder="예: 5000000"
            />
            <span className="bs-unit">원</span>
          </div>
        </div>

        <div className="ps-field">
          <label className="ps-label">목표 날짜</label>
          <input
            className="ps-input"
            type="date"
            value={savingsGoalDate}
            onChange={(e) => setSavingsGoalDate(e.target.value)}
          />
        </div>

        <div className="ps-field">
          <label className="ps-label">현재 저축액</label>
          <div className="bs-amount-wrapper">
            <input
              className="ps-input"
              type="number"
              min="0"
              value={savingsCurrentAmount}
              onChange={(e) => setSavingsCurrentAmount(e.target.value)}
              placeholder="예: 800000"
            />
            <span className="bs-unit">원</span>
          </div>
        </div>
      </div>

      <div className="ps-actions ps-actions-in-card">
        <button type="button" className="ps-save-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

export default BudgetSettings;
