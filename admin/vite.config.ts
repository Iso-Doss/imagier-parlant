import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// In development, /api and /storage are forwarded to the Laravel server (php artisan serve).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/storage": "http://localhost:8000",
    },
  },
})
