import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gwords/', // 👈 IMPORTANT: must match the repo name
})
