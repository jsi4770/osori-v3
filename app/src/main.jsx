import { StrictMode } from "react";
import React from "react"
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import Root from "./Root.jsx";
import { preventZoom } from "./preventZoom";

registerSW({ immediate: true });

// iOS 홈 화면 PWA는 autoUpdate 새로고침을 놓치는 경우가 있어, 새 서비스워커가
// 제어권을 잡는 순간(controllerchange) 한 번만 강제로 새로고침한다.
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

// iOS Safari 일반 브라우저에서도 핀치/더블탭 줌 차단
preventZoom();

createRoot(document.getElementById("root")).render(
  //<StrictMode>
    <Root />
  //</StrictMode>
);

