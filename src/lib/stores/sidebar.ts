import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// 初始化时检查是否是移动设备
const isMobile = browser ? window.innerWidth < 768 : false;

export const sidebarOpen = writable(!isMobile);
