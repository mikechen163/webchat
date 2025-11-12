# MCP完整实现详细设计文档

## 1. 项目概述

### 1.1 项目背景
当前Web AI聊天应用已经具备基础MCP（Model Coordination Protocol）支持，但需要升级为完整的用户自定义MCP服务器管理系统，以提供更灵活的AI工具调用能力。

### 1.2 设计目标
1. **用户自定义MCP服务器管理**：支持管理员通过界面配置、管理多个MCP服务器
2. **多传输协议支持**：支持stdio、HTTP、WebSocket三种传输方式
3. **动态激活机制**：允许用户切换和激活不同的MCP服务器
4. **工具信息上报**：自动将可用工具信息传递给LLM
5. **安全可控**：完善的权限管理和输入验证

### 1.3 设计原则
- **向后兼容**：不影响现有MCP功能
- **渐进式升级**：分阶段实施，风险可控
- **类型安全**：充分利用TypeScript的类型系统
- **测试驱动**：完善的单元测试和集成测试
- **用户体验**：直观友好的管理界面

## 2. 系统架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                     │
├─────────────────────────────────────────────────────────────┤
│  Admin UI  │  Chat Interface  │  MCP Config UI  │ Status   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                  API Layer (SvelteKit)                      │
├─────────────────────────────────────────────────────────────┤
│  /api/mcp-server  │  /api/chat/[id]  │  /api/models      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                 Business Logic Layer                        │
├─────────────────────────────────────────────────────────────┤
│  MCP Adapter  │  Auth Middleware  │  Validation Layer     │
│  Stdio Manager│  Process Manager  │  Error Handler        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Data Layer (Prisma)                      │
├─────────────────────────────────────────────────────────────┤
│  User  │  Session  │  Message  │  McpServerConfig        │
│  ModelConfig  │  Provider  │  UserPreference            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件设计

#### 2.2.1 MCP适配器增强设计

```typescript
// src/lib/mcp/types.ts
export enum McpTransport {
  STDIO = 'stdio',
  HTTP = 'http', 
  WEBSOCKET = 'websocket'
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  command?: string;        // for stdio
  baseUrl?: string;        // for http/websocket
  apiKey?: string;         // optional auth
  config?: Record<string, any>; // tool configurations
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomMcpProviderConfig {
  serverConfig: McpServerConfig;
  messages: Array<{ role: string; content: string }>;
}
```

#### 2.2.2 传输协议处理器

```typescript
// src/lib/mcp/transports/stdio.ts
export class StdioTransport {
  private process?: ChildProcess;
  private messageId = 0;
  
  constructor(private config: McpServerConfig) {}
  
  async initialize(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }
    
    // 安全验证命令
    this.validateCommand(this.config.command);
    
    this.process = spawn(this.config.command, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false, // 禁止shell注入
      env: { ...process.env, MCP_API_KEY: this.config.apiKey }
    });
    
    // 设置超时和错误处理
    this.setupProcessHandlers();
  }
  
  async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP server response timeout'));
      }, 30000);
      
      // 发送消息到stdin
      this.process!.stdin!.write(JSON.stringify({
        id: ++this.messageId,
        ...message
      }) + '\n');
      
      // 监听stdout响应
      const onData = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === this.messageId) {
            clearTimeout(timeout);
            resolve(response);
          }
        } catch (e) {
          // 忽略非JSON数据
        }
      };
      
      this.process!.stdout!.once('data', onData);
    });
  }
  
  private validateCommand(command: string): void {
    // 白名单验证，只允许特定路径和命令
    const allowedPaths = [
      '/usr/local/bin/',
      '/usr/bin/',
      process.cwd() + '/server/'
    ];
    
    const isAllowed = allowedPaths.some(path => 
      command.startsWith(path) || command.startsWith('./')
    );
    
    if (!isAllowed) {
      throw new Error('Command path not allowed');
    }
    
    // 禁止危险字符
    if (command.includes(';') || command.includes('&&') || command.includes('|')) {
      throw new Error('Command contains dangerous characters');
    }
  }
}
```

## 3. 数据库设计

### 3.1 新增数据模型

```prisma
// prisma/schema.prisma

enum McpTransport {
  STDIO
  HTTP
  WEBSOCKET
}

model McpServerConfig {
  id        String       @id @default(cuid())
  name      String       // 服务器名称，用于显示
  transport McpTransport // 传输方式
  command   String?      // stdio启动命令
  baseUrl   String?      // HTTP/WebSocket基础URL
  apiKey    String?      // API密钥（加密存储）
  config    Json?        // 工具配置信息
  isActive  Boolean      @default(false) // 激活状态
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  
  // 关联到用户偏好
  userPreferences UserPreference[]
  
  @@map("mcp_server_configs")
}

model UserPreference {
  id          String   @id @default(cuid())
  userId      String   @unique
  defaultModel String?
  searchModel String?
  theme       String?
  language    String?
  displayName String?
  mcpServerId String?  // 关联到MCP服务器
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User              @relation(fields: [userId], references: [id])
  mcpServer   McpServerConfig?  @relation(fields: [mcpServerId], references: [id])
  
  @@map("user_preferences")
}
```

### 3.2 数据访问层设计

```typescript
// src/lib/server/mcpRepository.ts
import { PrismaClient } from '@prisma/client';
import type { McpServerConfig, McpTransport } from '$lib/mcp/types';

export class McpRepository {
  constructor(private prisma: PrismaClient) {}
  
  async createServer(config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<McpServerConfig> {
    return this.prisma.mcpServerConfig.create({
      data: {
        name: config.name,
        transport: config.transport,
        command: config.command,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        config: config.config,
        isActive: config.isActive
      }
    });
  }
  
  async getActiveServer(): Promise<McpServerConfig | null> {
    return this.prisma.mcpServerConfig.findFirst({
      where: { isActive: true }
    });
  }
  
  async activateServer(id: string): Promise<McpServerConfig> {
    // 事务处理：确保只有一个激活的服务器
    return this.prisma.$transaction(async (tx) => {
      // 先停用所有服务器
      await tx.mcpServerConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      // 激活指定服务器
      return tx.mcpServerConfig.update({
        where: { id },
        data: { isActive: true }
      });
    });
  }
  
  async getServerById(id: string): Promise<McpServerConfig | null> {
    return this.prisma.mcpServerConfig.findUnique({
      where: { id }
    });
  }
  
  async updateServer(id: string, data: Partial<McpServerConfig>): Promise<McpServerConfig> {
    return this.prisma.mcpServerConfig.update({
      where: { id },
      data
    });
  }
  
  async deleteServer(id: string): Promise<void> {
    await this.prisma.mcpServerConfig.delete({
      where: { id }
    });
  }
  
  async listServers(): Promise<McpServerConfig[]> {
    return this.prisma.mcpServerConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

## 4. API设计

### 4.1 MCP服务器管理API

```typescript
// src/routes/api/mcp-server/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

// 输入验证schema
const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  transport: z.enum(['stdio', 'http', 'websocket']),
  command: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  config: z.record(z.any()).optional()
}).refine(
  (data) => {
    if (data.transport === 'stdio') {
      return !!data.command;
    } else {
      return !!data.baseUrl;
    }
  },
  {
    message: "Command required for stdio transport, baseUrl required for http/websocket"
  }
);

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // 权限验证
    if (!locals.auth.user?.role === 'admin') {
      throw error(403, 'Admin privileges required');
    }
    
    const body = await request.json();
    const validatedData = createServerSchema.parse(body);
    
    // 安全验证
    if (validatedData.command) {
      validateCommand(validatedData.command);
    }
    
    // 创建服务器配置
    const server = await mcpRepository.createServer({
      ...validatedData,
      isActive: false
    });
    
    // 返回数据（移除敏感信息）
    const { apiKey, ...safeData } = server;
    return json(safeData, { status: 201 });
    
  } catch (e) {
    if (e instanceof z.ZodError) {
      return json({ errors: e.errors }, { status: 400 });
    }
    throw error(500, 'Internal server error');
  }
};

export const GET: RequestHandler = async ({ locals }) => {
  // 权限验证
  if (!locals.auth.user?.role === 'admin') {
    throw error(403, 'Admin privileges required');
  }
  
  const servers = await mcpRepository.listServers();
  
  // 移除敏感信息
  const safeServers = servers.map(({ apiKey, ...server }) => ({
    ...server,
    hasApiKey: !!apiKey // 只返回是否有API密钥
  }));
  
  return json(safeServers);
};
```

### 4.2 激活API

```typescript
// src/routes/api/mcp-server/[id]/activate/+server.ts
export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    // 权限验证
    if (!locals.auth.user?.role === 'admin') {
      throw error(403, 'Admin privileges required');
    }
    
    const server = await mcpRepository.activateServer(params.id);
    
    if (!server) {
      throw error(404, 'Server not found');
    }
    
    // 返回激活的服务器信息
    const { apiKey, ...safeData } = server;
    return json(safeData);
    
  } catch (e) {
    throw error(500, 'Failed to activate server');
  }
};
```

### 4.3 聊天API集成

```typescript
// src/lib/server/mcpHelper.ts
import { McpRepository } from './mcpRepository';
import { callMcpProvider } from '$lib/mcp/adapter';
import { StdioTransport } from '$lib/mcp/transports/stdio';

export class McpHelper {
  constructor(
    private mcpRepository: McpRepository
  ) {}
  
  async getActiveMcpConfig() {
    return this.mcpRepository.getActiveServer();
  }
  
  async prepareMcpCall(messages: Array<{ role: string; content: string }>) {
    const activeServer = await this.getActiveMcpConfig();
    
    if (!activeServer) {
      return null;
    }
    
    // 构建工具描述信息
    const toolDescription = this.buildToolDescription(activeServer);
    
    return {
      server: activeServer,
      messages: [
        { role: 'system', content: toolDescription },
        ...messages
      ]
    };
  }
  
  private buildToolDescription(server: McpServerConfig): string {
    const baseDescription = `Available MCP tools from server "${server.name}":\n\n`;
    
    if (server.config?.tools) {
      const toolDescriptions = server.config.tools.map((tool: any) => 
        `- ${tool.name}: ${tool.description}\n  Usage: ${JSON.stringify(tool.inputSchema)}`
      ).join('\n\n');
      
      return baseDescription + toolDescriptions;
    }
    
    return baseDescription + 'No tool configuration available';
  }
  
  async callCustomMcpProvider(
    serverConfig: McpServerConfig, 
    messages: Array<{ role: string; content: string }>
  ) {
    switch (serverConfig.transport) {
      case 'stdio':
        return this.callStdioMcp(serverConfig, messages);
      case 'http':
        return callMcpProvider({
          baseUrl: serverConfig.baseUrl!,
          apiKey: serverConfig.apiKey
        }, messages);
      case 'websocket':
        return callMcpProvider({
          baseUrl: serverConfig.baseUrl!,
          apiKey: serverConfig.apiKey
        }, messages);
      default:
        throw new Error(`Unsupported transport: ${serverConfig.transport}`);
    }
  }
  
  private async callStdioMcp(
    serverConfig: McpServerConfig,
    messages: Array<{ role: string; content: string }>
  ) {
    const transport = new StdioTransport(serverConfig);
    
    try {
      await transport.initialize();
      
      const response = await transport.sendMessage({
        messages,
        stream: true
      });
      
      return response;
    } finally {
      await transport.cleanup();
    }
  }
}
```

## 5. 前端界面设计

### 5.1 管理界面组件结构

```svelte
<!-- src/routes/admin/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Select } from '$lib/components/ui/select';
  import { Card } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { toast } from '$lib/components/ui/toast';
  
  interface McpServer {
    id: string;
    name: string;
    transport: string;
    command?: string;
    baseUrl?: string;
    isActive: boolean;
    hasApiKey: boolean;
  }
  
  let servers: McpServer[] = [];
  let showForm = false;
  let editingServer: McpServer | null = null;
  let isLoading = false;
  
  // 表单数据
  let formData = {
    name: '',
    transport: 'http' as 'stdio' | 'http' | 'websocket',
    command: '',
    baseUrl: '',
    apiKey: '',
    config: ''
  };
  
  onMount(async () => {
    await loadServers();
  });
  
  async function loadServers() {
    try {
      const response = await fetch('/api/mcp-server');
      if (response.ok) {
        servers = await response.json();
      }
    } catch (error) {
      toast.error('Failed to load MCP servers');
    }
  }
  
  async function handleSubmit() {
    isLoading = true;
    
    try {
      const url = editingServer 
        ? `/api/mcp-server/${editingServer.id}` 
        : '/api/mcp-server';
      
      const method = editingServer ? 'PATCH' : 'POST';
      
      const payload = {
        name: formData.name,
        transport: formData.transport,
        ...(formData.transport === 'stdio' 
          ? { command: formData.command }
          : { baseUrl: formData.baseUrl }
        ),
        ...(formData.apiKey && { apiKey: formData.apiKey }),
        ...(formData.config && { config: JSON.parse(formData.config) })
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        toast.success(editingServer ? 'Server updated' : 'Server created');
        resetForm();
        await loadServers();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      isLoading = false;
    }
  }
  
  async function handleActivate(id: string) {
    if (!confirm('Activate this MCP server? This will deactivate the current active server.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/mcp-server/${id}/activate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success('Server activated');
        await loadServers();
      }
    } catch (error) {
      toast.error('Failed to activate server');
    }
  }
  
  function resetForm() {
    showForm = false;
    editingServer = null;
    formData = {
      name: '',
      transport: 'http',
      command: '',
      baseUrl: '',
      apiKey: '',
      config: ''
    };
  }
  
  function startEdit(server: McpServer) {
    editingServer = server;
    formData = {
      name: server.name,
      transport: server.transport as any,
      command: server.command || '',
      baseUrl: server.baseUrl || '',
      apiKey: '', // 不显示现有API密钥
      config: ''
    };
    showForm = true;
  }
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-bold">MCP Server Management</h2>
    <Button on:click={() => showForm = true}>
      Add MCP Server
    </Button>
  </div>
  
  {#if showForm}
    <Card class="p-6">
      <h3 class="text-lg font-semibold mb-4">
        {editingServer ? 'Edit' : 'Add'} MCP Server
      </h3>
      
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Name</label>
          <Input 
            bind:value={formData.name} 
            placeholder="My MCP Server"
            required
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Transport</label>
          <Select 
            bind:value={formData.transport}
            on:change={() => {
              formData.command = '';
              formData.baseUrl = '';
            }}
          >
            <option value="http">HTTP</option>
            <option value="websocket">WebSocket</option>
            <option value="stdio">Stdio</option>
          </Select>
        </div>
        
        {#if formData.transport === 'stdio'}
          <div>
            <label class="block text-sm font-medium mb-1">Command</label>
            <Input 
              bind:value={formData.command}
              placeholder="python /path/to/mcp_server.py"
              required
            />
          </div>
        {:else}
          <div>
            <label class="block text-sm font-medium mb-1">Base URL</label>
            <Input 
              bind:value={formData.baseUrl}
              placeholder="http://localhost:33333"
              required
            />
          </div>
        {/if}
        
        <div>
          <label class="block text-sm font-medium mb-1">API Key (optional)</label>
          <Input 
            bind:value={formData.apiKey}
            placeholder="sk-..."
            type="password"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Tool Config (JSON, optional)</label>
          <textarea 
            bind:value={formData.config}
            class="w-full h-32 p-2 border rounded"
            placeholder='{"tools": [...]}'
          ></textarea>
        </div>
        
        <div class="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : (editingServer ? 'Update' : 'Create')}
          </Button>
          <Button 
            type="button" 
            variant="outline"
            on:click={resetForm}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  {/if}
  
  <div class="grid gap-4">
    {#each servers as server}
      <Card class="p-4">
        <div class="flex justify-between items-start">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-semibold">{server.name}</h4>
              {#if server.isActive}
                <Badge variant="default">Active</Badge>
              {/if}
            </div>
            <p class="text-sm text-gray-600">
              {server.transport.toUpperCase()}
              {#if server.transport === 'stdio'}
                - {server.command}
              {:else}
                - {server.baseUrl}
              {/if}
            </p>
            {#if server.hasApiKey}
              <p class="text-xs text-gray-500">Has API Key</p>
            {/if}
          </div>
          
          <div class="flex gap-2">
            {#if !server.isActive}
              <Button 
                size="sm"
                variant="outline"
                on:click={() => handleActivate(server.id)}
              >
                Activate
              </Button>
            {/if}
            <Button 
              size="sm"
              variant="outline"
              on:click={() => startEdit(server)}
            >
              Edit
            </Button>
          </div>
        </div>
      </Card>
    {/each}
  </div>
</div>
```

## 6. 安全设计

### 6.1 权限控制

```typescript
// src/lib/server/auth.ts
import type { RequestEvent } from '@sveltejs/kit';

export function requireAdmin(locals: App.Locals): void {
  if (!locals.auth.user || locals.auth.user.role !== 'admin') {
    throw error(403, 'Admin privileges required');
  }
}

export function requireAuth(locals: App.Locals): User {
  if (!locals.auth.user) {
    throw error(401, 'Authentication required');
  }
  return locals.auth.user;
}
```

### 6.2 输入验证

```typescript
// src/lib/server/validation.ts
import { z } from 'zod';

export const mcpServerSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Name contains invalid characters'),
  
  transport: z.enum(['stdio', 'http', 'websocket']),
  
  command: z.string()
    .optional()
    .refine(
      (val) => !val || isSafeCommand(val),
      'Command contains dangerous characters'
    ),
  
  baseUrl: z.string()
    .url('Invalid URL format')
    .optional()
    .refine(
      (val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('ws://') || val.startsWith('wss://'),
      'URL must use http/https/ws/wss protocol'
    ),
  
  apiKey: z.string()
    .optional()
    .refine(
      (val) => !val || val.length >= 10,
      'API key too short'
    ),
  
  config: z.record(z.any()).optional()
}).refine(
  (data) => {
    if (data.transport === 'stdio') {
      return !!data.command;
    } else {
      return !!data.baseUrl;
    }
  },
  {
    message: "Command required for stdio, baseUrl required for http/websocket"
  }
);

function isSafeCommand(command: string): boolean {
  // 禁止shell元字符
  const dangerousChars = [';', '&', '|', '`', '$', '(', ')', '<', '>'];
  return !dangerousChars.some(char => command.includes(char));
}
```

### 6.3 API密钥安全

```typescript
// src/lib/server/crypto.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.randomBytes(32).toString('hex');

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptApiKey(encryptedKey: string): string {
  const [ivHex, encrypted] = encryptedKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

## 7. 错误处理与监控

### 7.1 错误处理策略

```typescript
// src/lib/server/errorHandler.ts
export class McpError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export const MCP_ERROR_CODES = {
  SERVER_NOT_FOUND: 'SERVER_NOT_FOUND',
  SERVER_NOT_ACTIVE: 'SERVER_NOT_ACTIVE',
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',
  TIMEOUT: 'TIMEOUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;

// 统一的错误处理
export function handleMcpError(error: any): McpError {
  if (error instanceof McpError) {
    return error;
  }
  
  if (error.code === 'ENOENT') {
    return new McpError(
      'MCP server command not found',
      MCP_ERROR_CODES.SERVER_NOT_FOUND,
      404
    );
  }
  
  if (error.message?.includes('timeout')) {
    return new McpError(
      'MCP server response timeout',
      MCP_ERROR_CODES.TIMEOUT,
      408
    );
  }
  
  return new McpError(
    'MCP server error',
    MCP_ERROR_CODES.TRANSPORT_ERROR,
    500,
    error.message
  );
}
```

### 7.2 监控与日志

```typescript
// src/lib/server/monitoring.ts
import { createLogger } from 'winston';

export const mcpLogger = createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/mcp-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/mcp-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export function logMcpCall(
  serverId: string,
  serverName: string,
  transport: string,
  duration: number,
  success: boolean,
  error?: any
) {
  mcpLogger.info({
    type: 'mcp_call',
    serverId,
    serverName,
    transport,
    duration,
    success,
    error: error?.message
  });
}
```

## 8. 测试策略

### 8.1 单元测试

```typescript
// src/lib/mcp/adapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { callMcpProvider } from './adapter';

describe('MCP Adapter', () => {
  it('should handle HTTP transport', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined })
        })
      }
    });
    
    global.fetch = mockFetch;
    
    const result = await callMcpProvider(
      { baseUrl: 'http://localhost:33333' },
      [{ role: 'user', content: 'test' }]
    );
    
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:33333',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });
  
  it('should handle mock responses', async () => {
    const result = await callMcpProvider(
      { baseUrl: 'mock-server' },
      [{ role: 'user', content: 'test' }]
    );
    
    expect(result.ok).toBe(true);
    expect(result.body).toBeDefined();
  });
});
```

### 8.2 集成测试

```typescript
// tests/mcp-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';

describe('MCP Integration', () => {
  let mcpServer: any;
  
  beforeAll(async () => {
    // 启动测试MCP服务器
    mcpServer = spawn('python', ['server/mcp_server.py'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
  
  afterAll(async () => {
    if (mcpServer) {
      mcpServer.kill();
    }
  });
  
  it('should execute Python code via MCP', async () => {
    const response = await fetch('http://localhost:33333/tools/execute_python', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'print("Hello from MCP!")',
        timeout: 5
      })
    });
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.result).toContain('Hello from MCP!');
  });
  
  it('should list directory via MCP', async () => {
    const response = await fetch('http://localhost:33333/tools/list_dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.' })
    });
    
    const result = await response.json();
    expect(Array.isArray(result.items)).toBe(true);
  });
});
```

## 9. 部署与运维

### 9.1 环境配置

```bash
# .env.example
# MCP Configuration
MCP_MAX_SERVERS=10
MCP_TIMEOUT_MS=30000
MCP_STDIO_ALLOWED_PATHS=/usr/local/bin,/usr/bin,./server
MCP_ENCRYPTION_KEY=your-encryption-key-here

# Monitoring
MCP_LOG_LEVEL=info
MCP_METRICS_ENABLED=true
```

### 9.2 健康检查

```typescript
// src/routes/api/mcp-server/health/+server.ts
export const GET: RequestHandler = async () => {
  const activeServer = await mcpRepository.getActiveServer();
  
  if (!activeServer) {
    return json({ status: 'no_active_server' }, { status: 503 });
  }
  
  try {
    // 健康检查逻辑
    const isHealthy = await checkServerHealth(activeServer);
    
    return json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      server: {
        id: activeServer.id,
        name: activeServer.name,
        transport: activeServer.transport
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
};
```

## 10. 性能优化

### 10.1 连接池管理

```typescript
// src/lib/mcp/connectionPool.ts
export class McpConnectionPool {
  private connections = new Map<string, any>();
  private maxConnections = 10;
  
  async getConnection(serverId: string, serverConfig: McpServerConfig) {
    let connection = this.connections.get(serverId);
    
    if (!connection || !this.isConnectionHealthy(connection)) {
      connection = await this.createConnection(serverConfig);
      this.connections.set(serverId, connection);
    }
    
    return connection;
  }
  
  private async createConnection(config: McpServerConfig) {
    switch (config.transport) {
      case 'websocket':
        return new WebSocket(config.baseUrl!, {
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}
        });
      
      case 'http':
        return {
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          lastUsed: Date.now()
        };
      
      default:
        throw new Error(`Connection pooling not supported for ${config.transport}`);
    }
  }
  
  private isConnectionHealthy(connection: any): boolean {
    if (connection instanceof WebSocket) {
      return connection.readyState === WebSocket.OPEN;
    }
    
    // HTTP连接检查最后使用时间
    const maxAge = 5 * 60 * 1000; // 5分钟
    return Date.now() - connection.lastUsed < maxAge;
  }
  
  cleanup() {
    for (const [id, connection] of this.connections) {
      if (connection instanceof WebSocket) {
        connection.close();
      }
      this.connections.delete(id);
    }
  }
}
```

### 10.2 缓存策略

```typescript
// src/lib/mcp/cache.ts
export class McpToolCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 60 * 1000; // 1分钟缓存
  
  get(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  clear() {
    this.cache.clear();
  }
}
```

## 11. 扩展性考虑

### 11.1 插件架构

```typescript
// src/lib/mcp/pluginSystem.ts
export interface McpPlugin {
  name: string;
  version: string;
  initialize(config: any): Promise<void>;
  getTools(): McpTool[];
  executeTool(name: string, params: any): Promise<any>;
}

export class PluginManager {
  private plugins = new Map<string, McpPlugin>();
  
  async loadPlugin(pluginPath: string): Promise<void> {
    const pluginModule = await import(pluginPath);
    const plugin: McpPlugin = new pluginModule.default();
    
    this.plugins.set(plugin.name, plugin);
  }
  
  async initializePlugin(name: string, config: any): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    await plugin.initialize(config);
  }
  
  getAllTools(): McpTool[] {
    const tools: McpTool[] = [];
    
    for (const plugin of this.plugins.values()) {
      tools.push(...plugin.getTools());
    }
    
    return tools;
  }
}
```

### 11.2 多语言支持

```typescript
// src/lib/mcp/i18n.ts
export const MCP_TRANSLATIONS = {
  en: {
    errors: {
      SERVER_NOT_FOUND: 'MCP server not found',
      SERVER_NOT_ACTIVE: 'No active MCP server',
      TRANSPORT_ERROR: 'MCP transport error',
      TIMEOUT: 'MCP server timeout',
      VALIDATION_ERROR: 'Invalid MCP configuration'
    },
    tools: {
      execute_python: 'Execute Python Code',
      list_dir: 'List Directory',
      read_file: 'Read File',
      save_script: 'Save Script',
      install: 'Install Package'
    }
  },
  zh: {
    errors: {
      SERVER_NOT_FOUND: 'MCP服务器未找到',
      SERVER_NOT_ACTIVE: '没有激活的MCP服务器',
      TRANSPORT_ERROR: 'MCP传输错误',
      TIMEOUT: 'MCP服务器超时',
      VALIDATION_ERROR: 'MCP配置无效'
    },
    tools: {
      execute_python: '执行Python代码',
      list_dir: '列出目录',
      read_file: '读取文件',
      save_script: '保存脚本',
      install: '安装包'
    }
  }
};
```

## 12. 开发计划

### 阶段一：基础架构（第1-2周）
- [ ] 数据库模型设计和迁移
- [ ] MCP类型定义和基础类
- [ ] API路由框架搭建
- [ ] 权限验证中间件

### 阶段二：核心功能（第3-4周）
- [ ] HTTP/WS传输协议实现
- [ ] Stdio传输协议实现
- [ ] MCP服务器CRUD API
- [ ] 激活机制实现

### 阶段三：集成与界面（第5周）
- [ ] 聊天API集成
- [ ] 工具信息上报
- [ ] 管理界面开发
- [ ] 表单验证和错误处理

### 阶段四：测试与优化（第6周）
- [ ] 单元测试编写
- [ ] 集成测试实现
- [ ] 性能优化
- [ ] 文档完善

### 阶段五：部署准备（第7-8周）
- [ ] 安全审计
- [ ] 监控配置
- [ ] 部署脚本
- [ ] 用户文档

## 13. 风险评估与缓解

### 13.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Stdio进程管理复杂 | 中 | 高 | 详细的进程生命周期管理，完善的错误处理 |
| WebSocket连接不稳定 | 低 | 中 | 连接池管理，自动重连机制 |
| 性能瓶颈 | 低 | 中 | 缓存策略，连接复用，异步处理 |
| 安全漏洞 | 低 | 高 | 严格的输入验证，权限控制，安全审计 |

### 13.2 项目风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 开发时间超期 | 中 | 中 | 分阶段交付，优先级管理 |
| 测试不充分 | 中 | 高 | 完善的测试策略，自动化测试 |
| 用户接受度低 | 低 | 中 | 用户反馈收集，界面优化 |
| 第三方依赖问题 | 低 | 低 | 版本锁定，备用方案 |

## 14. 成功标准

### 14.1 功能标准
- [ ] 支持三种传输协议（HTTP、WebSocket、Stdio）
- [ ] 完整的CRUD操作
- [ ] 动态激活机制
- [ ] 工具信息自动上报
- [ ] 安全可控的权限管理

### 14.2 性能标准
- [ ] MCP调用响应时间 < 5秒
- [ ] 支持并发连接数 > 10
- [ ] 内存使用合理，无内存泄漏
- [ ] 错误率 < 1%

### 14.3 用户体验标准
- [ ] 管理界面直观易用
- [ ] 错误提示清晰友好
- [ ] 操作流程简化
- [ ] 帮助文档完整

## 15. 总结

本详细设计文档提供了一个完整的MCP实现方案，涵盖了从架构设计到具体实现的各个方面。该方案基于现有项目的坚实基础，通过渐进式升级实现用户自定义MCP服务器管理功能。

关键优势：
- **技术可行性高**：基于成熟的现有架构
- **风险可控**：分阶段实施，向后兼容
- **扩展性强**：支持多种传输协议和工具
- **安全可靠**：完善的权限管理和输入验证
- **用户体验好**：直观的管理界面

预期该方案将显著提升产品的技术竞争力，为用户提供更灵活的AI工具调用能力。