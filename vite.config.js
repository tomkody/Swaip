import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Playwright specs live in e2e/ and run via `npm run test:e2e`.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
