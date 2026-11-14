import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: "https://itsmacc.github.io/sltp-web",
  plugins: [react()],
})
