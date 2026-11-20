import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api requests go to the Node server (npm run server, port 8788).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:8788" },
  },
});
