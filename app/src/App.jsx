import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MyPageLayout from "./features/auth/pages/MyPageLayout";
import MyPage from "./features/auth/pages/MyPage";
import CalendarView from "./features/menu/CalendarView";
import ProfileSettings from "./features/auth/pages/ProfileSettings";
import AuthLayout from "./layouts/AuthLayout";
import FindIdPage from "./features/auth/pages/FindIdPage";
import FindPasswordPage from "./features/auth/pages/FindPasswordPage";
import PrivateRoute from "./routes/PrivateRoute";
import { transactions } from './Data/mockData'; //목업 수입지출데이터
import RegisterPage from './features/auth/pages/RegisterPage';
import LoginPage from './features/auth/pages/LoginPage';
import ResetPasswordPage from "./features/auth/pages/ResetPasswordPage";
import ExpensePage from './features/auth/pages/ExpensePage';
import FixedTransPage from "./features/auth/pages/FixedTransPage";
import KakaoCallback from "./features/auth/pages/KakaoCallback";
import CoachChatPage from "./features/coaching/CoachChatPage";
import GrowthReportPage from "./features/coaching/GrowthReportPage";
import OnboardingPage from "./features/onboarding/OnboardingPage";
import { useAuth } from "./context/AuthContext";

// 로그인 여부에 따라 진입 지점을 분기(PWA 재실행/새로고침 시 세션 유지)
// 세션/방문 기록이 없는 첫 방문자는 온보딩으로, 이미 본 사람은 로그인으로 보냄
function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  const loggedIn = isAuthenticated && user && user.status !== "N";
  if (loggedIn) return <Navigate to="/mypage/assets" replace />;
  const onboarded = localStorage.getItem("osori_onboarded") === "true";
  return <Navigate to={onboarded ? "/login" : "/onboarding"} replace />;
}

// 이미 로그인된 사용자가 로그인/랜딩 화면에 오면 홈으로 보냄
function AnonOnly({ children }) {
  const { isAuthenticated, user } = useAuth();
  const loggedIn = isAuthenticated && user && user.status !== "N";
  if (loggedIn) return <Navigate to="/mypage/assets" replace />;
  return children;
}

function App() {
  const [calendarDate, setCalendarDate] = useState(new Date());

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* 온보딩: 첫 방문자 전용 풀스크린 (AuthLayout 밖) */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<AnonOnly><LoginPage /></AnonOnly>} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/find-id" element={<FindIdPage />} />
          <Route path="/find-password" element={<FindPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
        </Route>

        {/* 로그인 필요 */}
        <Route
          path="/mypage"
          element={
            <PrivateRoute>
              <MyPageLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<MyPage />} />
          <Route path="assets" element={<MyPage />} />

          <Route
            path="calendarView"
            element={
              <CalendarView
                transactions={transactions}
                currentDate={calendarDate}
                setCurrentDate={setCalendarDate}
              />
            }
          />

          <Route path="profileSettings" element={<ProfileSettings />}/>
          {/* 캘린더뷰가 가계부 기능을 흡수하면서 대체됨. 기존 링크/북마크가 안 깨지도록 리다이렉트만 유지 */}
          <Route path="myAccountBook" element={<Navigate to="/mypage/calendarView" replace />} />
          <Route path='expenseForm' element={<ExpensePage/>}/>
          <Route path="fixedTrans" element={<FixedTransPage />} />
          <Route path="coaching/chat/:threadId" element={<CoachChatPage />} />
          <Route path="coaching/report" element={<GrowthReportPage />} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
