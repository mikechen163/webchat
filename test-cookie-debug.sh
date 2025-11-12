#!/bin/bash

echo "=== Cookie调试测试 ==="

# 清除之前的cookie文件
rm -f cookie-jar.txt test-cookies.txt

echo "1. 测试登录..."
curl -X POST http://localhost:3000/auth/login \
  -d "email=admin@example.com&password=admin123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Origin: http://localhost:3000" \
  -H "Referer: http://localhost:3000/auth/login" \
  -c cookie-jar.txt \
  -v 2>&1 | grep -E "(Set-Cookie|Cookie|HTTP|Location)" | head -10

echo -e "\n2. 检查保存的Cookie..."
if [ -f cookie-jar.txt ]; then
  echo "Cookie文件内容:"
  cat cookie-jar.txt
else
  echo "❌ Cookie文件未创建"
fi

echo -e "\n3. 使用Cookie访问聊天页面..."
if [ -f cookie-jar.txt ]; then
  RESPONSE=$(curl -X GET http://localhost:3000/chat \
    -b cookie-jar.txt \
    -H "Origin: http://localhost:3000" \
    -L -v 2>&1)
  
  echo "响应状态:"
  echo "$RESPONSE" | grep -E "(HTTP|Location)" | head -5
  
  if echo "$RESPONSE" | grep -q "Redirecting to login"; then
    echo "❌ 仍然被重定向到登录"
  elif echo "$RESPONSE" | grep -q "200 OK"; then
    echo "✅ 成功访问聊天页面"
  fi
else
  echo "❌ 没有Cookie文件，无法测试"
fi

echo -e "\n4. 检查Cookie详细信息..."
if [ -f cookie-jar.txt ]; then
  echo "解析Cookie:"
  while IFS= read -r line; do
    if [[ $line =~ ^#.*$ ]]; then
      continue
    fi
    if [[ $line =~ ^[[:space:]]*$ ]]; then
      continue
    fi
    echo "Cookie行: $line"
  done < cookie-jar.txt
fi

echo -e "\n=== 测试完成 ==="