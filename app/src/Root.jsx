import App from "./App.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import { AppReadyProvider } from "./context/AppReadyContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { FeedbackProvider } from "./context/FeedbackContext.jsx";

// 넓은 화면(데스크톱)에서는 폰 프레임 없이 앱을 그대로 렌더링한다.
// 폭에 따른 레이아웃(사이드바 ↔ 하단 탭바)은 각 화면 CSS의 미디어쿼리가 담당한다.
function Root() {
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
