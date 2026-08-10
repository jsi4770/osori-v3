import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";

export default function PrivateRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useFeedback();
  const location = useLocation();

  // 인증 체크 로직
  const isUnauthorized = !isAuthenticated || !user || user.status === "N";
  const isDormant = user?.status === "H";
  const isInProfileSettings = location.pathname === "/mypage/profileSettings";

  useEffect(() => {
    if (isUnauthorized) {
      toast("로그인 후 이용 가능한 서비스입니다.", { type: "info" });
    }
  }, [isUnauthorized]); // 상태가 유효하지 않을 때 딱 한 번 실행

  // 1. 로그인하지 않았거나 탈퇴 회원(N)인 경우
  if (isUnauthorized) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 2. 휴면 회원(H)인 경우
  if (isDormant && !isInProfileSettings) {
    return <Navigate to="/mypage/profileSettings" replace />;
  }

  return children;
}
