import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

// 静态导入 PostCSS 插件
import tailwindcss from '@tailwindcss/postcss'; // 使用新的包
import autoprefixer from 'autoprefixer';

export default defineConfig({
    plugins: [
        sveltekit(), // SvelteKit 插件放在第一位
    ],
    resolve: {
        alias: {
            $lib: path.resolve('./src/lib'), // 使用绝对路径
        },
    },
    css: {
        postcss: {
            plugins: [
                tailwindcss, // 使用静态导入的插件
                autoprefixer, // 自动添加浏览器前缀
            ],
        },
    },
    server: {
        host: '0.0.0.0', // 监听所有网络接口
        port: 3000, // 可选：指定端口号，默认是 3000
    },
});