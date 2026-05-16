import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiOrigin = process.env.QIANQIU_API_ORIGIN || "http://localhost:3000";

export default defineConfig({
  root: "client",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    assetsDir: "client-assets"
  },
  server: {
    port: 5173,
    proxy: {
      "/api": apiOrigin
    }
  },
  preview: {
    port: 4173
  }
});
