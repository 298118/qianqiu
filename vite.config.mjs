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
    assetsDir: "client-assets",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!/[\\/]node_modules[\\/]/.test(id)) return undefined;
          if (/[\\/]node_modules[\\/](?:react|react-dom|react-router)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/]zustand[\\/]/.test(id)) return "vendor-state";
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return "vendor-icons";
          return "vendor";
        }
      }
    }
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
