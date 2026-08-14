import api from "./axios";

export const budgetApi = {

    // 주의: 백엔드 User VO의 bAmount 필드는 Jackson 직렬화 규칙 때문에 JSON에서 "bamount"
    // (대문자 A 없이 전부 소문자)로 오간다 — "bAmount"로 보내면 조용히 무시되고 0으로 저장된다.
    // 또한 이 엔드포인트는 전체 스냅샷을 요구한다: 일부 필드만 보내면 나머지가 0/null로 덮어써진다.
    update: async ({ userId, loginId, bamount, savingsGoalAmount, savingsGoalDate, savingsCurrentAmount }) => {
        const response = await api.patch('/user/budget', {
            userId,
            loginId,
            bamount,
            savingsGoalAmount,
            savingsGoalDate,
            savingsCurrentAmount,
        });
        return response.data;
    },

}

export default budgetApi;
