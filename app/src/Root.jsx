import { useEffect, useState } from "react";
import App from "./App.jsx";
import DesktopFrame from "./components/DesktopFrame.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import { AppReadyProvider } from "./context/AppReadyContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { FeedbackProvider } from "./context/FeedbackContext.jsx";

// 노트북 등 넓은 화면에서 열어도 실제 폰 화면 비율로 보이도록, 이 폭 이상이면
// 앱을 직접 렌더링하는 대신 폰 크기 iframe(DesktopFrame) 안에 같은 페이지를 띄운다.
// pointer: fine/hover: hover까지 같이 걸어서, 폭만 넓은 폰 가로모드(터치스크린)는
// 걸러내고 마우스·트랙패드가 있는 진짜 노트북/데스크톱에서만 프레임을 씌운다.
const DESKTOP_FRAME_QUERY = "(min-width: 600px) and (pointer: fine) and (hover: hover)";

function Root() {
  // iframe 내부(=DesktopFrame이 띄운 실제 앱)에서는 절대 다시 프레임을 씌우지 않는다.
  const isFramed = window.self !== window.top;
  const [isWide, setIsWide] = useState(
    () => !isFramed && window.matchMedia(DESKTOP_FRAME_QUERY).matches
  );

  useEffect(() => {
    if (isFramed) return;
    const mq = window.matchMedia(DESKTOP_FRAME_QUERY);
    const onChange = (e) => setIsWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [isFramed]);

  if (isWide) {
    return (
      <AppReadyProvider>
        <SplashScreen />
        <DesktopFrame />
      </AppReadyProvider>
    );
  }

  return (
    <AppReadyProvider>
      <SplashScreen />
      <ThemeProvider>
        <FeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </AppReadyProvider>
  );
}

export default Root;
