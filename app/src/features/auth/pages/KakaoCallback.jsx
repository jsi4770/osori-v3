import { useEffect, useRef } from "react"; // useRef 추가
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../api/http";
import { useAuth } from "../../../context/AuthContext";
import { useFeedback } from "../../../context/FeedbackContext";

export default function KakaoCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useFeedback();
  const hasCalled = useRef(false); // 실행 여부 체크용

 useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    
    // 코드가 있고, 아직 API를 호출하지 않았을 때만 실행
    if (code && !hasCalled.current) {
      hasCalled.current = true; // 실행됨으로 표시

      // 인가 요청 때 쓴 것과 똑같은 콜백 URL(현재 창의 origin 기준 — beta/v3 등 배포 도메인이
      // 여러 개여도 항상 지금 접속한 도메인과 일치)을 그대로 서버에 넘겨야 카카오 토큰 교환이 통과한다.
      const redirectUri = `${window.location.origin}/auth/kakao/callback`;

      apiFetch(`/user/kakao/callback?code=${code}&redirectUri=${encodeURIComponent(redirectUri)}`)
        .then((res) => {
          const status = res?.user?.status;

          if (status === "H") {
            toast(res.message, { type: "info" });
          } else if (status === "N") {
            toast(res.message, { type: "error" });
            navigate("/login", { replace: true });
            return;
          }

          login(res); // 일반 로그인 마냥 감

          if (res.isNewMember) {
            toast("회원가입이 완료되었습니다. 환영합니다!", { type: "success" });
          }

          navigate("/mypage", { replace: true });
        })
        .catch((err) => {
          toast(err.message || "로그인 처리 중 오류가 발생했습니다.", { type: "error" });
          console.error(err);
          navigate("/login");
        });
    }
  }, [login, navigate]);

  return <div>카카오 로그인 처리 중...</div>;
}
