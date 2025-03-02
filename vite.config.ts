import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

// ✅ 正确导入方式
import tailwindcss from 'tailwindcss'; // 核心包
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss(), // ✅ 正确调用
        autoprefixer()
      ],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // 添加代理配置
      '/api': {
        target: 'http://your-backend-url',
        changeOrigin: true,
        secure: false
      }
  },
});