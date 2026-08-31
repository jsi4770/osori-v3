import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 서버 푸시(push 이벤트)를 직접 처리해야 하므로 커스텀 서비스워커(src/sw.js)를 쓴다.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: false, // main.jsx에서 virtual:pwa-register로 직접 등록
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "OSORI - 오늘의 소비 리포트",
        short_name: "OSORI",
        description: "AI 재무 코칭 가계부 - 넛지 기반으로 소비 습관을 코칭해드립니다",
        theme_color: "#0066ff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // 홈 화면 아이콘을 길게 눌렀을 때 뜨는 빠른 실행 메뉴 (위젯 대체)
        shortcuts: [
          {
            name: "빠른 지출 입력",
            short_name: "지출 입력",
            description: "자연어로 지출을 바로 기록합니다",
            url: "/mypage/expenseForm?quick=1",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "빠른 수입 입력",
            short_name: "수입 입력",
            description: "자연어로 수입을 바로 기록합니다",
            url: "/mypage/expenseForm?quick=1&type=IN",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "오늘의 소비 리포트",
            short_name: "리포트",
            description: "이번 달 소비 분석 보기",
            url: "/mypage/coaching/report",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
      },
      devOptions: {
        // 개발 모드에서는 서비스워커를 비활성 (프로덕션 빌드에서만 동작)
        enabled: false,
      },
    }),
  ],
  define: {
    global: "window",
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/fincoach": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
