import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isGitHubPagesBuild = process.env.GITHUB_PAGES === 'true'

// https://vite.dev/config/
export default defineConfig({
  base: isGitHubPagesBuild ? '/Kino-XII/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    restoreMocks: true,
  },
})