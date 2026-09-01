import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useFeedback } from "../../../context/FeedbackContext";
import budgetApi from "../../../api/budgetApi";
import "./BudgetSettings.css";

// 설정 탭의 월 예산: 저장하면 홈 화면에 "이번 달 쓸 수 있는 금액(잔액)"이 표시된다.
function BudgetSettings() {
  const { user, setUser } = useAuth();
  const { toast } = useFeedback();

  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setMonthlyBudget(user.bamount ? String(user.bamount) : "");
  }, [user]);

  const handleSave = async () => {
    if (!user?.userId) return;

    setIsSaving(true);
    try {
      const res = await budgetApi.update({
        userId: user.userId,
        loginId: user.loginId,
        bamount: Number(monthlyBudget) || 0,
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
      <div className="ps-theme-desc">
        이번 달 쓸 수 있는 지출 한도를 정하면, 홈 화면에서 남은 금액을 볼 수 있어요.
      </div>
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

      <div className="ps-actions ps-actions-in-card">
        <button type="button" className="ps-save-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

export default BudgetSettings;
