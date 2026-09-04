import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    watch: {
      // Docker Desktop's Windows bind mount doesn't reliably forward
      // inotify events into the Linux container, so Vite's default
      // fs.watch-based HMR never fires. Polling trades a bit of CPU
      // for changes actually being picked up.
      usePolling: true,
      interval: 300,
    },
  },
})
