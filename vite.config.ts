import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // The About section shows the version only; the commit hash is not in the
  // bundle, so it is injected here at build time rather than hard-coded.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
  build: {
    outDir: "dist",
  },
})
