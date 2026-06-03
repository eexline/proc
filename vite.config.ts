import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || env.API_PORT || "3001";
  const apiTarget = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [
      react(),
      {
        name: "log-proxy",
        configureServer(server) {
          const host = server.config.server.host;
          const port = server.config.server.port;
          console.log(`[vite] http://127.0.0.1:${port}/`);
          console.log(`[vite] /api -> ${apiTarget}`);
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
