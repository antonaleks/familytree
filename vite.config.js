import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base:'./' → относительные пути к ассетам, чтобы работало на GitHub Pages
// в подпапке /<repo>/ без знания имени репо на этапе сборки.
export default defineConfig({
  base: './',
  plugins: [react()]
});
