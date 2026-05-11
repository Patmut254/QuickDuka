import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker is generated at build time and served from /sw.js
      filename: "sw.js",
      // Precache all built assets so the app works offline
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff,woff2}"],
        // Don't cache Firebase/external requests
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/firebase/],
      },
      // Use the existing manifest.json from public/
      // (manifest option here would override it — we leave it to public/)
      manifest: false,
      injectRegister: "auto",
      devOptions: {
        // Enable SW in dev so you can test locally without building
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    include: ["@emailjs/browser"],
  },
});
