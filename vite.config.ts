// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // ou vue, svelte, etc.

// 👇 ajuste o base para o nome do seu repositório
export default defineConfig({
  plugins: [react()],
  base: '/jarvis-frontend/', // 🔁 substitua se o nome do repositório for diferente
})
