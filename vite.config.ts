import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { publicWebUrl } from "./src/product/publicUrl";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const url = publicWebUrl(env.VITE_PUBLIC_WEB_URL);
  if (mode === "release" && !url) throw new Error("Set VITE_PUBLIC_WEB_URL to the public HTTPS origin before building a release.");
  return { plugins: [react(), {
    name: "picture-score-public-metadata",
    transformIndexHtml() {
      return url ? [
        { tag: "link", attrs: { rel: "canonical", href: url } },
        { tag: "meta", attrs: { property: "og:url", content: url } },
        { tag: "meta", attrs: { property: "og:image", content: url + "social/picture-score-og-v2.png" } },
        { tag: "meta", attrs: { property: "og:image:secure_url", content: url + "social/picture-score-og-v2.png" } },
        { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { property: "og:image:alt", content: "ピクスコの水彩PSロゴ。描いた絵が、メロディになる。" } },
        { tag: "meta", attrs: { name: "twitter:image", content: url + "social/picture-score-og-v2.png" } },
        { tag: "meta", attrs: { name: "twitter:image:alt", content: "ピクスコの水彩PSロゴ。描いた絵が、メロディになる。" } },
      ] : [];
    },
  }, VitePWA({
    registerType: "prompt", injectRegister: false,
    includeAssets: ["favicon*.svg", "favicon*.ico", "icons/*.png", "privacy.html", "art/*", "sfx/*"],
    manifest: {
      id: "/", name: "Picture Score", short_name: "ピクスコ",
      description: "絵を描いて、音楽に。作品を残して、音つきで共有しよう。",
      lang: "ja", start_url: "/", scope: "/", display: "standalone",
      theme_color: "#fcf9ef", background_color: "#fcf9ef",
      icons: [
        { src: "/icons/picture-score-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/picture-score-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/picture-score-maskable-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg,webp,ogg,txt}"],
      globIgnores: ["**/social/**"],
      cleanupOutdatedCaches: true, clientsClaim: false, skipWaiting: false,
      navigateFallbackDenylist: [/^\/privacy\.html$/],
    },
    devOptions: { enabled: false },
  })] };
});
