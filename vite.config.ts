import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 部署在 /<repo>/ 子路径下
export default defineConfig({
  base: '/football-tactics-board/',
  plugins: [react()],
});
