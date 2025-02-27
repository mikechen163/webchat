export const ssr = false;

// 禁用数据缓存，确保每次导航都重新加载
export function load({ data }) {
  return {
    ...data,
    timestamp: Date.now() // 添加时间戳强制更新
  };
}
