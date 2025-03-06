// 创建一个API辅助函数

export async function callApi(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // 确保Cookie被发送
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    }
  });
  
  return response;
}
