# MCP系统部署指南

## 部署概述

本指南提供了MCP（Model Coordination Protocol）完整系统的部署步骤，包括环境准备、配置、部署和监控。

## 系统要求

### 最低要求
- **Node.js**: 18.0.0 或更高版本
- **内存**: 2GB RAM
- **存储**: 1GB 可用空间
- **网络**: 稳定的互联网连接

### 推荐配置
- **Node.js**: 20.x LTS
- **内存**: 4GB RAM
- **存储**: 5GB 可用空间
- **CPU**: 2核心以上
- **网络**: 高速互联网连接

## 环境准备

### 1. 安装Node.js
```bash
# 使用Node版本管理器（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 验证安装
node --version
npm --version
```

### 2. 安装系统依赖
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential python3 git

# CentOS/RHEL
sudo yum install -y gcc-c++ make python3 git

# macOS (需要Homebrew)
brew install python3 git
```

### 3. 安装数据库（SQLite用于开发，PostgreSQL用于生产）
```bash
# SQLite（开发环境）
sudo apt-get install sqlite3

# PostgreSQL（生产环境）
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## 应用程序部署

### 1. 获取代码
```bash
git clone <repository-url>
cd webchat
```

### 2. 安装依赖
```bash
npm install
```

### 3. 环境配置

#### 创建环境文件
```bash
cp .env.example .env
```

#### 配置必需的环境变量
```bash
# 基本配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
DATABASE_URL="file:./prod.db"  # SQLite
# DATABASE_URL="postgresql://user:password@localhost:5432/mcp_db"  # PostgreSQL

# 加密密钥（生成新的）
ENCRYPTION_KEY=<your-32-byte-hex-key>
# 生成命令: openssl rand -hex 32

# MCP配置
MCP_MAX_SERVERS=10
MCP_TIMEOUT_MS=30000
MCP_STDIO_ALLOWED_PATHS=/usr/local/bin,/usr/bin
MCP_LOG_LEVEL=info

# 安全配置
SESSION_SECRET=<your-session-secret>
CORS_ORIGIN=https://your-domain.com
TRUST_PROXY=true

# 监控配置
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_PORT=8080
```

#### 生成加密密钥
```bash
# 生成32字节加密密钥
openssl rand -hex 32

# 生成会话密钥
openssl rand -hex 64
```

### 4. 数据库初始化
```bash
# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 验证数据库连接
npx prisma db ping
```

### 5. 构建应用程序
```bash
# 构建生产版本
npm run build

# 验证构建结果
ls -la build/
```

## 生产环境部署

### 1. 使用PM2进程管理器
```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'mcp-app',
    script: 'build/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

### 2. 使用Systemd（Linux）
```bash
# 创建systemd服务文件
sudo tee /etc/systemd/system/mcp-app.service > /dev/null << 'EOF'
[Unit]
Description=MCP Application
After=network.target

[Service]
Type=simple
User=mcp-user
WorkingDirectory=/opt/mcp-app
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable mcp-app
sudo systemctl start mcp-app
```

### 3. 使用Docker部署
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 构建应用
RUN npm run build

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp-user -u 1001

# 更改权限
RUN chown -R mcp-user:nodejs /app
USER mcp-user

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 启动应用
CMD ["node", "build/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://mcp_user:mcp_password@postgres:5432/mcp_db
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=mcp_db
      - POSTGRES_USER=mcp_user
      - POSTGRES_PASSWORD=mcp_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - mcp-app
    restart: unless-stopped

volumes:
  postgres_data:
```

## 反向代理配置

### Nginx配置
```nginx
# nginx.conf
upstream mcp_app {
    server mcp-app:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://mcp_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        # 连接超时
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## 监控与日志

### 1. 应用日志配置
```bash
# 创建日志目录
mkdir -p logs

# 配置日志轮转
sudo tee /etc/logrotate.d/mcp-app > /dev/null << 'EOF'
/opt/mcp-app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 mcp-user mcp-user
    postrotate
        pm2 reload mcp-app
    endscript
}
EOF
```

### 2. 监控工具配置
```bash
# 安装监控工具
npm install -g clinic pm2-logrotate

# 性能监控
clinic doctor -- node build/index.js

# 日志监控
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 3. 健康检查脚本
```javascript
// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // 健康
  } else {
    process.exit(1); // 不健康
  }
});

req.on('error', () => {
  process.exit(1); // 不健康
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1); // 不健康
});

req.end();
```

## 性能优化

### 1. 数据库优化
```sql
-- 创建索引
CREATE INDEX idx_mcp_server_config_name ON mcp_server_configs(name);
CREATE INDEX idx_mcp_server_config_is_active ON mcp_server_configs(isActive);
CREATE INDEX idx_mcp_server_config_transport ON mcp_server_configs(transport);

-- 启用查询缓存（PostgreSQL）
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
```

### 2. 应用层优化
```bash
# 启用Node.js集群模式
export NODE_CLUSTER_MODE=true

# 内存优化
export NODE_OPTIONS="--max-old-space-size=4096"

# 启用压缩
export ENABLE_COMPRESSION=true
```

### 3. 缓存策略
```javascript
// 在应用中添加缓存
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCached(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}
```

## 备份策略

### 1. 数据库备份
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"

# PostgreSQL备份
pg_dump -h localhost -U mcp_user mcp_db > "$BACKUP_DIR/mcp_db_$DATE.sql"

# SQLite备份（如果使用）
cp /path/to/dev.db "$BACKUP_DIR/mcp_db_$DATE.db"

# 清理旧备份（保留30天）
find "$BACKUP_DIR" -name "mcp_db_*.sql" -mtime +30 -delete
find "$BACKUP_DIR" -name "mcp_db_*.db" -mtime +30 -delete
```

### 2. 配置文件备份
```bash
# 备份配置文件
cp .env "$BACKUP_DIR/config_$DATE.env"
cp ecosystem.config.js "$BACKUP_DIR/config_$DATE.js"

# 备份SSL证书
cp -r ssl/ "$BACKUP_DIR/ssl_$DATE/"
```

## 灾难恢复

### 1. 数据库恢复
```bash
#!/bin/bash
# restore.sh
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# 停止应用
pm2 stop mcp-app

# 恢复数据库
psql -h localhost -U mcp_user mcp_db < "$BACKUP_FILE"

# 重启应用
pm2 start mcp-app
```

### 2. 配置恢复
```bash
# 恢复配置文件
cp "$BACKUP_DIR/config_latest.env" .env
cp "$BACKUP_DIR/config_latest.js" ecosystem.config.js

# 恢复SSL证书
cp -r "$BACKUP_DIR/ssl_latest/" ssl/
```

## 安全加固

### 1. 系统安全
```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 配置防火墙
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 配置fail2ban
sudo apt-get install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

### 2. 应用安全
```bash
# 设置文件权限
chmod 600 .env
chmod 755 logs/
chown -R mcp-user:mcp-user /opt/mcp-app

# 禁用不必要的服务
sudo systemctl disable telnet
sudo systemctl disable ftp
```

## 部署验证

### 1. 功能验证
```bash
# 测试API端点
curl -X GET http://localhost:3000/api/mcp-server/health

# 测试数据库连接
curl -X GET http://localhost:3000/api/mcp-server \
  -H "Authorization: Bearer <admin-token>"

# 测试MCP服务器创建
curl -X POST http://localhost:3000/api/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"name": "Test Server", "transport": "http", "baseUrl": "http://localhost:3000"}'
```

### 2. 性能验证
```bash
# 负载测试
npm install -g autocannon
autocannon -c 100 -d 30 http://localhost:3000/api/mcp-server/health

# 内存使用检查
pm2 monit
```

### 3. 安全验证
```bash
# SSL证书检查
curl -v https://your-domain.com

# 安全头检查
curl -I https://your-domain.com
```

## 维护计划

### 日常维护
- [ ] 检查应用状态
- [ ] 监控日志文件
- [ ] 验证备份完整性

### 周度维护
- [ ] 更新依赖项
- [ ] 检查系统资源
- [ ] 安全扫描

### 月度维护
- [ ] 性能优化
- [ ] 安全审计
- [ ] 备份测试

## 故障排除

### 常见问题

1. **应用无法启动**
   ```bash
   # 检查日志
   pm2 logs mcp-app
   
   # 检查端口占用
   netstat -tlnp | grep 3000
   
   # 检查环境变量
   pm2 env mcp-app
   ```

2. **数据库连接失败**
   ```bash
   # 检查数据库状态
   sudo systemctl status postgresql
   
   # 检查连接字符串
   npx prisma db ping
   ```

3. **权限问题**
   ```bash
   # 检查文件权限
   ls -la /opt/mcp-app
   
   # 检查用户权限
   id mcp-user
   ```

## 支持联系

- **技术支持**: support@your-company.com
- **安全响应**: security@your-company.com
- **紧急联系**: +1-xxx-xxx-xxxx

---

**注意**: 本部署指南应定期更新以反映最新的安全最佳实践和系统变更。