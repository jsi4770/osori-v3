import { useCallback, useEffect, useState } from "react";
import categoryApi from "../api/categoryApi";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../constants/categories";

// 유저가 설정 탭에서 추가한 커스텀 카테고리 + 숨긴 기본 카테고리가 반영된 목록을,
// 이 유저의 사용 빈도순으로 정렬해 반환한다(설정 탭에서 카테고리를 추가/삭제/숨김하면
// reload()로 다시 불러와 즉시 반영). type은 항상 "IN" | "OUT". userId가 없으면(로딩 중 등)
// 정적 기본값으로 폴백해 화면이 비지 않게 한다.
export default function useCategories(userId, type) {
  const fallback = type === "IN" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [categories, setCategories] = useState(fallback);

  const reload = useCallback(() => {
    if (!userId) {
      setCategories(fallback);
      return;
    }
    categoryApi
      .list(userId, type)
      .then((data) => setCategories(Array.isArray(data) && data.length > 0 ? data : fallback))
      .catch(() => setCategories(fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, type]);

  useEffect(() => {
    reload();
  }, [reload]);

  return [categories, reload];
}
