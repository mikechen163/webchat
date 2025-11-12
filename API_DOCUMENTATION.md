# MCP API文档

## 概述

本文档描述了MCP（Model Context Protocol）服务器的RESTful API接口，用于管理用户自定义的MCP服务器配置。

## 基础信息

- **Base URL**: `https://api.your-domain.com`
- **Authentication**: Bearer Token
- **Content-Type**: `application/json`
- **API版本**: v1

## 认证

所有API端点都需要管理员权限。在请求头中包含：
```
Authorization: Bearer <admin-token>
```

## 错误响应格式

所有错误响应都遵循以下格式：
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional error details
  }
}
```

## API端点

### 1. MCP服务器管理

#### 1.1 获取MCP服务器列表

**GET** `/api/mcp-server`

获取所有MCP服务器的列表（需要管理员权限）。

**查询参数：**
- `includeInactive` (boolean, optional): 是否包含非激活的服务器，默认为false
- `limit` (integer, optional): 返回结果数量限制，最大100

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "cl1234567890",
      "name": "My MCP Server",
      "transport": "http",
      "baseUrl": "http://localhost:3000",
      "isActive": true,
      "hasApiKey": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

**错误响应：**
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限

---

#### 1.2 创建MCP服务器

**POST** `/api/mcp-server`

创建新的MCP服务器配置（需要管理员权限）。

**请求体：**
```json
{
  "name": "My MCP Server",
  "transport": "http",
  "baseUrl": "http://localhost:3000",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "config": {
    "tools": [
      {
        "name": "execute_python",
        "description": "Execute Python code",
        "inputSchema": {
          "type": "object",
          "properties": {
            "code": {"type": "string"}
          },
          "required": ["code"]
        }
      }
    ]
  }
}
```

**字段说明：**
- `name` (string, required): 服务器名称，1-100字符，只允许字母、数字、空格、下划线和连字符
- `transport` (string, required): 传输协议，可选值："http", "websocket", "stdio"
- `baseUrl` (string, conditional): 基础URL，HTTP/WebSocket传输时必需
- `command` (string, conditional): 启动命令，Stdio传输时必需
- `apiKey` (string, optional): API密钥，用于认证
- `config` (object, optional): 工具配置，JSON格式

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": "cl1234567890",
    "name": "My MCP Server",
    "transport": "http",
    "baseUrl": "http://localhost:3000",
    "isActive": false,
    "hasApiKey": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "MCP server created successfully"
}
```

**错误响应：**
- `400 Bad Request`: 请求数据验证失败
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限
- `409 Conflict`: 服务器名称已存在

---

#### 1.3 获取特定MCP服务器

**GET** `/api/mcp-server/{id}`

获取指定ID的MCP服务器详情（需要管理员权限）。

**路径参数：**
- `id` (string, required): MCP服务器ID

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": "cl1234567890",
    "name": "My MCP Server",
    "transport": "http",
    "baseUrl": "http://localhost:3000",
    "isActive": true,
    "hasApiKey": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应：**
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限
- `404 Not Found`: 指定的服务器不存在

---

#### 1.4 更新MCP服务器

**PATCH** `/api/mcp-server/{id}`

更新指定MCP服务器的配置（需要管理员权限）。

**路径参数：**
- `id` (string, required): MCP服务器ID

**请求体：**
```json
{
  "name": "Updated Server Name",
  "baseUrl": "http://localhost:8080",
  "apiKey": "sk-new-api-key-xxxxxxxx"
}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": "cl1234567890",
    "name": "Updated Server Name",
    "transport": "http",
    "baseUrl": "http://localhost:8080",
    "isActive": false,
    "hasApiKey": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "MCP server updated successfully"
}
```

**错误响应：**
- `400 Bad Request`: 请求数据验证失败
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限
- `404 Not Found`: 指定的服务器不存在

---

#### 1.5 删除MCP服务器

**DELETE** `/api/mcp-server/{id}`

删除指定的MCP服务器（需要管理员权限）。

**路径参数：**
- `id` (string, required): MCP服务器ID

**成功响应：**
```json
{
  "success": true,
  "message": "MCP server deleted successfully"
}
```

**错误响应：**
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限或尝试删除激活的服务器
- `404 Not Found`: 指定的服务器不存在

---

#### 1.6 激活MCP服务器

**POST** `/api/mcp-server/{id}/activate`

激活指定的MCP服务器（需要管理员权限）。将自动停用当前激活的服务器。

**路径参数：**
- `id` (string, required): MCP服务器ID

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": "cl1234567890",
    "name": "My MCP Server",
    "transport": "http",
    "baseUrl": "http://localhost:3000",
    "isActive": true,
    "hasApiKey": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "MCP server \"My MCP Server\" activated successfully"
}
```

**错误响应：**
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限
- `404 Not Found`: 指定的服务器不存在

---

#### 1.7 获取MCP服务器健康状态

**GET** `/api/mcp-server/health`

获取当前激活的MCP服务器的健康状态（需要管理员权限）。

**成功响应：**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "server": {
      "id": "cl1234567890",
      "name": "My MCP Server",
      "transport": "http"
    },
    "details": {
      "message": "Server is responding",
      "statusCode": 200,
      "responseTime": 150
    },
    "totalServers": 3,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**可能的状态：**
- `healthy`: 服务器正常运行
- `unhealthy`: 服务器存在问题
- `no_active_server`: 当前没有激活的服务器

**错误响应：**
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限

---

#### 1.8 测试MCP服务器连接

**POST** `/api/mcp-server/test`

测试MCP服务器的连接性和可用性（需要管理员权限）。

**请求体：**
```json
{
  "serverId": "cl1234567890",
  "serverConfig": {
    "name": "Test Server",
    "transport": "http",
    "baseUrl": "http://localhost:3000",
    "apiKey": "test-api-key"
  }
}
```

**注意**: 必须提供 `serverId` 或 `serverConfig` 中的一个。

**成功响应：**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Connection successful",
    "details": {
      "statusCode": 200,
      "statusText": "OK"
    }
  }
}
```

**错误响应：**
- `400 Bad Request`: 请求数据验证失败
- `401 Unauthorized`: 未提供有效的认证令牌
- `403 Forbidden`: 用户没有管理员权限
- `404 Not Found`: 指定的服务器不存在（当使用serverId时）

---

### 2. 聊天API集成

#### 2.1 发送消息（MCP支持）

聊天API已集成MCP支持，当存在激活的MCP服务器时，会自动将工具信息包含在系统消息中。

**行为说明：**
- 如果存在激活的MCP服务器，系统会自动构建工具描述信息
- 工具信息会作为系统消息发送给语言模型
- 模型可以基于工具信息生成工具调用请求

**工具调用格式：**
```json
{
  "tool": "execute_python",
  "code": "print('Hello, World!')",
  "timeout": 5
}
```

**工具响应处理：**
- 系统会自动检测消息中的工具调用
- 执行相应的MCP工具
- 将结果返回给模型继续对话

---

## 数据模型

### MCP服务器配置

```typescript
interface McpServerConfig {
  id: string;
  name: string;
  transport: "http" | "websocket" | "stdio";
  command?: string;        // Stdio传输时使用
  baseUrl?: string;        // HTTP/WebSocket传输时使用
  apiKey?: string;         // 加密的API密钥
  config?: McpToolConfig;  // 工具配置
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface McpToolConfig {
  tools?: McpTool[];
  capabilities?: McpCapabilities;
  metadata?: Record<string, any>;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: string;
    properties: Record<string, any>;
  };
}
```

---

## 错误代码

| 错误代码 | 描述 | HTTP状态 |
|----------|------|----------|
| `VALIDATION_ERROR` | 请求数据验证失败 | 400 |
| `SERVER_NOT_FOUND` | MCP服务器不存在 | 404 |
| `SERVER_NOT_ACTIVE` | 没有激活的MCP服务器 | 503 |
| `TRANSPORT_ERROR` | 传输协议错误 | 500 |
| `CONNECTION_FAILED` | 连接失败 | 503 |
| `TIMEOUT` | 操作超时 | 408 |
| `TOOL_NOT_FOUND` | 工具不存在 | 404 |
| `TOOL_EXECUTION_ERROR` | 工具执行错误 | 500 |
| `INVALID_TOOL_PARAMS` | 工具参数无效 | 400 |
| `PERMISSION_DENIED` | 权限不足 | 403 |
| `ADMIN_REQUIRED` | 需要管理员权限 | 403 |

---

## 速率限制

- **标准限制**: 100请求/分钟/IP
- **管理员**: 500请求/分钟/用户
- **创建/更新**: 10请求/分钟/用户

---

## 示例代码

### Node.js客户端示例
```javascript
// 创建MCP服务器
async function createMcpServer() {
  const response = await fetch('/api/mcp-server', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Python Executor',
      transport: 'http',
      baseUrl: 'http://localhost:33333',
      config: {
        tools: [{
          name: 'execute_python',
          description: 'Execute Python code',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string' }
            },
            required: ['code']
          }
        }]
      }
    })
  });
  
  const result = await response.json();
  return result.data;
}

// 激活服务器
async function activateMcpServer(serverId) {
  const response = await fetch(`/api/mcp-server/${serverId}/activate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  const result = await response.json();
  return result.data;
}

// 测试连接
async function testMcpServer(serverId) {
  const response = await fetch('/api/mcp-server/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ serverId })
  });
  
  const result = await response.json();
  return result.data;
}
```

### Python客户端示例
```python
import requests
import json

class McpClient:
    def __init__(self, base_url, admin_token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {admin_token}',
            'Content-Type': 'application/json'
        }
    
    def create_server(self, server_config):
        response = requests.post(
            f'{self.base_url}/api/mcp-server',
            headers=self.headers,
            json=server_config
        )
        return response.json()
    
    def activate_server(self, server_id):
        response = requests.post(
            f'{self.base_url}/api/mcp-server/{server_id}/activate',
            headers=self.headers
        )
        return response.json()
    
    def test_connection(self, server_id):
        response = requests.post(
            f'{self.base_url}/api/mcp-server/test',
            headers=self.headers,
            json={'serverId': server_id}
        )
        return response.json()

# 使用示例
client = McpClient('https://api.your-domain.com', 'your-admin-token')

# 创建服务器
server = client.create_server({
    'name': 'My Python Executor',
    'transport': 'http',
    'baseUrl': 'http://localhost:33333',
    'config': {
        'tools': [{
            'name': 'execute_python',
            'description': 'Execute Python code',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'code': {'type': 'string'}
                },
                'required': ['code']
            }
        }]
    }
})

print(f"Created server: {server['data']['name']}")
```

---

## 变更日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持HTTP、WebSocket、Stdio传输协议
- 完整的CRUD操作
- 服务器激活机制
- 健康检查和连接测试
- 工具配置支持

### v1.1.0 (2024-02-01)
- 添加批量操作支持
- 增强错误处理
- 性能优化
- 安全加固

---

## 支持

如需技术支持或有任何问题，请联系：
- **技术支持**: support@your-company.com
- **API问题**: api-support@your-company.com
- **文档反馈**: docs@your-company.com