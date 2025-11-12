/**
 * MCP API集成测试
 * 测试MCP相关的API端点
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// 测试配置
const TEST_TIMEOUT = 30000;
const TEST_ADMIN_TOKEN = 'test-admin-token';
const TEST_USER_TOKEN = 'test-user-token';

describe('MCP API Integration Tests', () => {
  let prisma: PrismaClient;
  let baseUrl: string;

  beforeAll(async () => {
    // 初始化数据库连接
    prisma = new PrismaClient();
    baseUrl = 'http://localhost:5173'; // 假设这是测试服务器地址

    // 清理测试数据
    await prisma.mcpServerConfig.deleteMany({});
    
    // 创建测试用户（需要管理员权限）
    await prisma.user.upsert({
      where: { email: 'test-admin@example.com' },
      update: {
        role: 'admin'
      },
      create: {
        email: 'test-admin@example.com',
        passwordHash: 'hashed-password',
        role: 'admin'
      }
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // 清理测试数据
    await prisma.mcpServerConfig.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: 'test-admin@example.com' }
    });
    
    // 关闭数据库连接
    await prisma.$disconnect();
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // 清理MCP服务器测试数据
    await prisma.mcpServerConfig.deleteMany({});
  });

  describe('MCP Server API', () => {
    it('should require admin authentication', async () => {
      // 测试未认证的请求
      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'GET'
      });

      expect(response.status).toBe(401);
    });

    it('should reject non-admin users', async () => {
      // 创建普通用户
      await prisma.user.upsert({
        where: { email: 'test-user@example.com' },
        update: {
          role: 'user'
        },
        create: {
          email: 'test-user@example.com',
          passwordHash: 'hashed-password',
          role: 'user'
        }
      });

      // 测试普通用户访问
      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_USER_TOKEN}`
        }
      });

      expect(response.status).toBe(403);

      // 清理测试用户
      await prisma.user.delete({
        where: { email: 'test-user@example.com' }
      });
    });

    it('should create MCP server with valid data', async () => {
      const serverData = {
        name: 'Test API Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-api-key',
        config: {
          tools: [{
            name: 'test_tool',
            description: 'Test tool',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' }
              }
            }
          }]
        }
      };

      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      expect(response.status).toBe(201);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe(serverData.name);
      expect(result.data.transport).toBe(serverData.transport);
      expect(result.data.baseUrl).toBe(serverData.baseUrl);
      expect(result.data.hasApiKey).toBe(true);
      expect(result.data.apiKey).toBeUndefined(); // API key should be masked
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '', // Empty name
        transport: 'http'
        // Missing baseUrl
      };

      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(invalidData)
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent duplicate server names', async () => {
      const serverData = {
        name: 'Duplicate Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000'
      };

      // 创建第一个服务器
      const response1 = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      expect(response1.status).toBe(201);

      // 尝试创建同名服务器
      const response2 = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      expect(response2.status).toBe(409);
    });

    it('should list all MCP servers', async () => {
      // 创建测试服务器
      const servers = [
        {
          name: 'List Test Server 1',
          transport: 'http',
          baseUrl: 'http://localhost:3001'
        },
        {
          name: 'List Test Server 2',
          transport: 'websocket',
          baseUrl: 'ws://localhost:3002'
        }
      ];

      for (const serverData of servers) {
        await fetch(`${baseUrl}/api/mcp-server`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
          },
          body: JSON.stringify(serverData)
        });
      }

      // 获取服务器列表
      const response = await fetch(`${baseUrl}/api/mcp-server?includeInactive=true`, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should get specific MCP server by ID', async () => {
      // 创建测试服务器
      const serverData = {
        name: 'Get Test Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000'
      };

      const createResponse = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      const createdServer = await createResponse.json();
      const serverId = createdServer.data.id;

      // 获取特定服务器
      const response = await fetch(`${baseUrl}/api/mcp-server/${serverId}`, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(serverId);
      expect(result.data.name).toBe(serverData.name);
    });

    it('should update MCP server', async () => {
      // 创建测试服务器
      const serverData = {
        name: 'Update Test Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000'
      };

      const createResponse = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      const createdServer = await createResponse.json();
      const serverId = createdServer.data.id;

      // 更新服务器
      const updateData = {
        name: 'Updated Server Name',
        baseUrl: 'http://localhost:8080'
      };

      const response = await fetch(`${baseUrl}/api/mcp-server/${serverId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe(updateData.name);
      expect(result.data.baseUrl).toBe(updateData.baseUrl);
    });

    it('should delete MCP server', async () => {
      // 创建测试服务器
      const serverData = {
        name: 'Delete Test Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000'
      };

      const createResponse = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      const createdServer = await createResponse.json();
      const serverId = createdServer.data.id;

      // 删除服务器
      const response = await fetch(`${baseUrl}/api/mcp-server/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');

      // 验证服务器已被删除
      const getResponse = await fetch(`${baseUrl}/api/mcp-server/${serverId}`, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(getResponse.status).toBe(404);
    });

    it('should activate MCP server', async () => {
      // 创建测试服务器
      const serverData = {
        name: 'Activate Test Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000'
      };

      const createResponse = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      const createdServer = await createResponse.json();
      const serverId = createdServer.data.id;

      // 激活服务器
      const response = await fetch(`${baseUrl}/api/mcp-server/${serverId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
    });

    it('should check MCP server health', async () => {
      // 创建测试服务器
      const serverData = {
        name: 'Health Test Server',
        transport: 'http',
        baseUrl: 'http://httpbin.org/status/200'
      };

      const createResponse = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      const createdServer = await createResponse.json();
      const serverId = createdServer.data.id;

      // 激活服务器
      await fetch(`${baseUrl}/api/mcp-server/${serverId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      // 检查健康状态
      const response = await fetch(`${baseUrl}/api/mcp-server/health`, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('healthy');
      expect(result.data.server).toBeDefined();
    });

    it('should test MCP server connection', async () => {
      // 创建测试服务器
      const serverData = {
        name: 'Connection Test Server',
        transport: 'http',
        baseUrl: 'http://httpbin.org/status/200'
      };

      const createResponse = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      const createdServer = await createResponse.json();
      const serverId = createdServer.data.id;

      // 测试连接
      const response = await fetch(`${baseUrl}/api/mcp-server/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify({ serverId })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
    });
  });

  describe('API Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: 'invalid-json-data'
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle non-existent server ID', async () => {
      const nonExistentId = 'non-existent-id-12345';

      const response = await fetch(`${baseUrl}/api/mcp-server/${nonExistentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.error.code).toBe('SERVER_NOT_FOUND');
    });

    it('should handle activation of non-existent server', async () => {
      const nonExistentId = 'non-existent-id-12345';

      const response = await fetch(`${baseUrl}/api/mcp-server/${nonExistentId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.error.code).toBe('SERVER_NOT_FOUND');
    });
  });

  describe('API Security', () => {
    it('should sanitize API keys in responses', async () => {
      const serverData = {
        name: 'Security Test Server',
        transport: 'http',
        baseUrl: 'http://localhost:3000',
        apiKey: 'sk-very-secret-api-key-1234567890abcdef'
      };

      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(serverData)
      });

      expect(response.status).toBe(201);

      const result = await response.json();
      expect(result.data.apiKey).toBeUndefined(); // Should not return raw API key
      expect(result.data.hasApiKey).toBe(true); // Should indicate API key exists
    });

    it('should validate transport-specific requirements', async () => {
      // 测试stdio传输缺少command
      const invalidStdioData = {
        name: 'Invalid Stdio Server',
        transport: 'stdio'
        // Missing command
      };

      const response = await fetch(`${baseUrl}/api/mcp-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        },
        body: JSON.stringify(invalidStdioData)
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error.message).toContain('Command is required for stdio transport');
    });
  });
});