
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./MyPage.css";
import { useAuth } from "../../../context/AuthContext";
import { IconHome, IconCalendar, IconTrendingUp, IconUser, IconReceipt } from "../../../components/icons";

const MyPageLayout = ({refreshGroupList}) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const displayName = user?.userName || user?.name || "회원";

  return (
    <div className="mypage-container">
      <div className="mobile-topbar">
        <div className="mobile-topbar-logo" onClick={() => navigate("/mypage/assets")}>OSORI</div>

        <button
          className="mobile-profile-chip"
          onClick={() => navigate("/mypage/profileSettings")}
          aria-label="프로필 설정으로 이동"
        >
          <span className="mobile-profile-name">{displayName}</span>
        </button>
      </div>

      <aside className="sidebar">
        <div className="logo" onClick={() => navigate("/mypage/assets")} style={{ cursor: "pointer", padding: "0 20px 30px" }}>
          OSORI
        </div>

        <ul className="sidebar-menu">
          <li>
            <NavLink to="/mypage/assets" className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}>
              <IconHome size={19} /> <span>홈</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/mypage/calendarView" className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}>
              <IconCalendar size={19} /> <span>캘린더뷰</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/mypage/coaching/report" className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}>
              <IconTrendingUp size={19} /> <span>성장 리포트</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/mypage/fixedTrans"
              className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
            >
              <IconReceipt size={19} /> <span>고정지출</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/mypage/profileSettings" className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}>
              <IconUser size={19} /> <span>프로필 설정</span>
            </NavLink>
          </li>

        </ul>

        <button className="logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
      </aside>

      <nav className="mobile-bottom-nav">
        <NavLink to="/mypage/assets" className={({ isActive }) => `mbn-item ${isActive ? "active" : ""}`}>
          <span className="mbn-icon"><IconHome size={21} /></span>
          <span className="mbn-label">홈</span>
        </NavLink>
        <NavLink to="/mypage/calendarView" className={({ isActive }) => `mbn-item ${isActive ? "active" : ""}`}>
          <span className="mbn-icon"><IconCalendar size={21} /></span>
          <span className="mbn-label">캘린더</span>
        </NavLink>
        <NavLink to="/mypage/coaching/report" className={({ isActive }) => `mbn-item ${isActive ? "active" : ""}`}>
          <span className="mbn-icon"><IconTrendingUp size={21} /></span>
          <span className="mbn-label">리포트</span>
        </NavLink>
        <NavLink to="/mypage/fixedTrans" className={({ isActive }) => `mbn-item ${isActive ? "active" : ""}`}>
          <span className="mbn-icon"><IconReceipt size={21} /></span>
          <span className="mbn-label">고정지출</span>
        </NavLink>
        <NavLink to="/mypage/profileSettings" className={({ isActive }) => `mbn-item ${isActive ? "active" : ""}`}>
          <span className="mbn-icon"><IconUser size={21} /></span>
          <span className="mbn-label">설정</span>
        </NavLink>
      </nav>

      <main className="mypage-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MyPageLayout;
