# MCP用户操作手册

## 概述

MCP（Model Coordination Protocol）功能允许您配置和管理自定义的AI工具服务器，为语言模型提供强大的工具调用能力。本手册将指导您如何使用MCP服务器管理功能。

## 快速开始

### 1. 访问MCP管理界面
1. 登录系统
2. 导航到 **管理设置** → **MCP服务器**
3. 您将看到MCP服务器管理界面

### 2. 创建您的第一个MCP服务器
1. 点击 **"添加MCP服务器"** 按钮
2. 填写服务器配置信息
3. 选择适当的传输协议
4. 保存配置

## 详细功能说明

### MCP服务器类型

#### HTTP服务器
- **适用场景**: 远程API服务、Web服务
- **优点**: 易于配置、跨平台、支持负载均衡
- **配置要求**: 服务器URL、API密钥（可选）

#### WebSocket服务器
- **适用场景**: 实时通信、流式数据
- **优点**: 低延迟、双向通信、支持推送
- **配置要求**: WebSocket URL、API密钥（可选）

#### Stdio服务器
- **适用场景**: 本地脚本、命令行工具
- **优点**: 本地执行、直接访问系统资源
- **配置要求**: 启动命令、工作目录

### 创建MCP服务器

#### 步骤1：基本信息
- **服务器名称**: 为您的MCP服务器指定一个描述性名称
- **传输类型**: 选择HTTP、WebSocket或Stdio

#### 步骤2：连接配置
根据传输类型填写相应信息：

**HTTP/WebSocket:**
- **基础URL**: 服务器的完整URL（如：https://api.example.com）
- **API密钥**: 如果服务器需要认证，请输入API密钥

**Stdio:**
- **启动命令**: 启动MCP服务器的完整命令（如：python /path/to/mcp_server.py）

#### 步骤3：工具配置（可选）
```json
{
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
```

#### 步骤4：测试连接
- 点击 **"测试"** 按钮验证连接
- 查看测试结果确保服务器可访问

### 管理现有服务器

#### 激活服务器
1. 在服务器列表中找到要激活的服务器
2. 点击 **"激活"** 按钮
3. 确认激活操作（将自动停用当前激活的服务器）

#### 编辑服务器
1. 点击服务器卡片上的 **"编辑"** 按钮
2. 修改需要更新的配置
3. 保存更改

#### 测试服务器连接
1. 点击 **"测试"** 按钮
2. 系统将验证服务器连接和响应
3. 查看测试结果

#### 删除服务器
1. 点击 **"删除"** 按钮
2. 确认删除操作
3. **注意**: 无法删除当前激活的服务器

## 使用场景示例

### 场景1：代码执行工具
**目标**: 让AI能够执行Python代码

**配置步骤**:
1. 创建HTTP服务器
2. URL: `http://localhost:33333`
3. 工具配置:
```json
{
  "tools": [{
    "name": "execute_python",
    "description": "Execute Python code safely",
    "inputSchema": {
      "type": "object",
      "properties": {
        "code": {"type": "string"},
        "timeout": {"type": "number"}
      },
      "required": ["code"]
    }
  }]
}
```

### 场景2：文件系统操作
**目标**: 让AI能够读取文件和列出目录

**配置步骤**:
1. 创建Stdio服务器
2. 命令: `python /path/to/file_tools.py`
3. 工具配置:
```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read file contents",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {"type": "string"}
        },
        "required": ["path"]
      }
    },
    {
      "name": "list_dir",
      "description": "List directory contents",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {"type": "string"}
        }
      }
    }
  ]
}
```

### 场景3：网络API调用
**目标**: 让AI能够获取实时数据

**配置步骤**:
1. 创建HTTP服务器
2. URL: `https://api.weather.com/v1`
3. API密钥: 您的天气API密钥
4. 工具配置:
```json
{
  "tools": [{
    "name": "get_weather",
    "description": "Get current weather information",
    "inputSchema": {
      "type": "object",
      "properties": {
        "location": {"type": "string"}
      },
      "required": ["location"]
    }
  }]
}
```

## 最佳实践

### 1. 安全建议
- **API密钥保护**: 不要将API密钥暴露在客户端代码中
- **权限控制**: 仅授权用户可访问MCP管理功能
- **输入验证**: 始终在MCP服务器端验证输入数据
- **错误处理**: 实施适当的错误处理和日志记录

### 2. 性能优化
- **连接池**: 对于高频使用的服务器，实施连接池
- **缓存**: 对静态数据实施缓存策略
- **超时设置**: 为长时间操作设置合理的超时

### 3. 监控和维护
- **健康检查**: 定期检查服务器健康状态
- **日志监控**: 监控MCP服务器日志
- **性能指标**: 跟踪响应时间和错误率

## 故障排除

### 常见问题

#### 连接测试失败
**症状**: 测试连接时显示失败
**可能原因**:
- 服务器URL不正确
- 网络连接问题
- 服务器未启动
- 认证失败

**解决方案**:
1. 验证服务器URL是否正确
2. 检查网络连接
3. 确认服务器正在运行
4. 验证API密钥是否有效

#### 工具调用无响应
**症状**: AI尝试调用工具但没有响应
**可能原因**:
- MCP服务器未激活
- 工具名称不匹配
- 参数格式错误
- 服务器内部错误

**解决方案**:
1. 确认MCP服务器已激活
2. 检查工具名称和参数格式
3. 查看MCP服务器日志
4. 测试工具调用功能

#### 权限错误
**症状**: 无法访问MCP管理功能
**可能原因**:
- 用户权限不足
- 会话过期
- 角色配置错误

**解决方案**:
1. 确认用户具有管理员权限
2. 重新登录系统
3. 联系系统管理员

### 调试技巧

1. **启用详细日志**: 在MCP服务器中启用调试日志
2. **逐步测试**: 先测试基本连接，再测试复杂功能
3. **隔离问题**: 分别测试网络、认证、工具调用等环节
4. **参考文档**: 查阅MCP协议规范和服务器文档

## 高级功能

### 1. 动态工具发现
某些MCP服务器支持运行时工具发现：
```javascript
// 在MCP服务器中实现工具发现端点
app.get('/tools', (req, res) => {
  res.json({
    tools: availableTools
  });
});
```

### 2. 工具版本管理
```json
{
  "tools": [{
    "name": "execute_python",
    "version": "2.0.0",
    "description": "Execute Python code v2",
    // ... 其他配置
  }]
}
```

### 3. 多服务器协调
可以配置多个MCP服务器，每个提供不同的工具集：
- 代码执行服务器
- 文件操作服务器
- 网络请求服务器
- 数据库查询服务器

## 更新和维护

### 1. 定期检查更新
- 关注MCP协议更新
- 更新工具配置
- 升级服务器软件

### 2. 备份策略
- 定期备份MCP服务器配置
- 导出工具定义
- 保存API密钥（安全存储）

### 3. 性能监控
- 监控服务器响应时间
- 跟踪工具使用频率
- 分析错误日志

## 获取帮助

### 文档资源
- [MCP协议规范](https://modelcontextprotocol.io/)
- [API文档](./API_DOCUMENTATION.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)

### 支持渠道
- **技术支持**: 通过系统内置帮助功能
- **问题报告**: 使用问题跟踪系统
- **功能请求**: 提交功能改进建议

### 社区资源
- 用户论坛
- 最佳实践分享
- 工具市场

---

**提示**: 本手册会定期更新以反映新功能和最佳实践。建议定期查看最新版本。