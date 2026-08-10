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

      apiFetch(`/user/kakao/callback?code=${code}`)
        .then((res) => {
          if (res.isNewMember) {
            navigate("/social-register", { 
              state: { kakaoEmail: res.email, kakaoNickname: res.nickName, providerUserId: res.providerUserId } 
            });
          } else {
            const status = res?.user?.status;

            if(status==="H")  {
              toast(res.message, { type: "info" });
            } else if(status==="N"){
              toast(res.message, { type: "error" });
              navigate("/login", { replace: true });
              return;
            }
            
            login(res); // 일반 로그인 마냥 감
            navigate("/mypage", { replace: true });
          }
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
