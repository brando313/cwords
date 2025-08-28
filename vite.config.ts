import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/cwords/', // 👈 IMPORTANT: must match the repo name
})
