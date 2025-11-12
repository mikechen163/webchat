/**
 * MCP集成测试
 * 测试完整的MCP功能流程
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { createMcpHelper } from '../src/lib/server/mcpHelper';
import { McpRepository } from '../src/lib/server/mcpRepository';

// 测试配置
const TEST_MCP_SERVER_PORT = 33334;
const TEST_TIMEOUT = 30000;

// 模拟的MCP服务器响应
const mockMcpServer = `
import json
import sys
import time

def handle_request(request):
    if request.get('type') == 'tool':
        tool = request.get('tool')
        if tool == 'execute_python':
            code = request.get('code', '')
            return {
                'success': True,
                'result': f'Executed: {code}',
                'output': 'Hello from MCP'
            }
        elif tool == 'list_dir':
            path = request.get('path', '.')
            return {
                'success': True,
                'items': ['file1.txt', 'file2.py', 'directory']
            }
    return {'success': False, 'error': 'Unknown request'}

def main():
    print('MCP Test Server Started', file=sys.stderr)
    sys.stdout.flush()
    
    while True:
        try:
            line = sys.stdin.readline().strip()
            if not line:
                continue
                
            request = json.loads(line)
            response = handle_request(request)
            response['id'] = request.get('id', 1)
            
            print(json.dumps(response))
            sys.stdout.flush()
            
        except json.JSONDecodeError:
            print(json.dumps({'error': 'Invalid JSON', 'id': 1}))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({'error': str(e), 'id': 1}))
            sys.stdout.flush()

if __name__ == '__main__':
    main()
`;

describe('MCP Integration Tests', () => {
  let prisma: PrismaClient;
  let mcpHelper: ReturnType<typeof createMcpHelper>;
  let mcpRepository: McpRepository;
  let testMcpProcess: ChildProcess | null = null;

  beforeAll(async () => {
    // 初始化数据库连接
    prisma = new PrismaClient();
    mcpRepository = new McpRepository(prisma);
    mcpHelper = createMcpHelper();

    // 清理测试数据
    await prisma.mcpServerConfig.deleteMany({});
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // 清理测试数据
    await prisma.mcpServerConfig.deleteMany({});
    
    // 终止MCP测试服务器
    if (testMcpProcess && !testMcpProcess.killed) {
      testMcpProcess.kill();
    }
    
    // 关闭数据库连接
    await prisma.$disconnect();
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // 清理测试数据
    await prisma.mcpServerConfig.deleteMany({});
  });

  describe('MCP Server Management', () => {
    it('should create and manage MCP server configuration', async () => {
      // 创建MCP服务器配置
      const serverConfig = {
        name: 'Test MCP Server',
        transport: 'http' as const,
        baseUrl: `http://localhost:${TEST_MCP_SERVER_PORT}`,
        apiKey: 'test-api-key',
        config: {
          tools: [{
            name: 'execute_python',
            description: 'Execute Python code',
            inputSchema: {
              type: 'object',
              properties: {
                code: { type: 'string' }
              }
            }
          }]
        },
        isActive: false
      };

      const createdServer = await mcpRepository.createServer(serverConfig);

      expect(createdServer).toBeDefined();
      expect(createdServer.name).toBe(serverConfig.name);
      expect(createdServer.transport).toBe(serverConfig.transport);
      expect(createdServer.baseUrl).toBe(serverConfig.baseUrl);
      expect(createdServer.isActive).toBe(false);

      // 验证服务器列表
      const servers = await mcpRepository.listServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe(serverConfig.name);

      // 激活服务器
      const activatedServer = await mcpRepository.activateServer(createdServer.id);
      expect(activatedServer.isActive).toBe(true);

      // 验证激活状态
      const activeServer = await mcpRepository.getActiveServer();
      expect(activeServer).toBeDefined();
      expect(activeServer!.id).toBe(createdServer.id);
    });

    it('should handle server validation errors', async () => {
      // 测试无效的服务器配置
      const invalidConfig = {
        name: 'Invalid Server',
        transport: 'stdio' as const,
        // 缺少必需的command字段
        isActive: false
      };

      await expect(mcpRepository.createServer(invalidConfig)).rejects.toThrow(
        'Command is required for stdio transport'
      );
    });

    it('should prevent deletion of active server', async () => {
      // 创建并激活服务器
      const serverConfig = {
        name: 'Active Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: false
      };

      const server = await mcpRepository.createServer(serverConfig);
      await mcpRepository.activateServer(server.id);

      // 尝试删除激活的服务器
      await expect(mcpRepository.deleteServer(server.id)).rejects.toThrow(
        'Cannot delete active MCP server. Please deactivate it first.'
      );
    });
  });

  describe('MCP Helper Functions', () => {
    it('should prepare MCP call with tool descriptions', async () => {
      // 创建MCP服务器配置
      const serverConfig = {
        name: 'Helper Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        config: {
          tools: [
            {
              name: 'execute_python',
              description: 'Execute Python code safely',
              inputSchema: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  timeout: { type: 'number' }
                },
                required: ['code']
              }
            },
            {
              name: 'read_file',
              description: 'Read file contents',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' }
                },
                required: ['path']
              }
            }
          ]
        },
        isActive: true
      };

      await mcpRepository.createServer(serverConfig);
      await mcpRepository.activateServer((await mcpRepository.listServers())[0].id);

      // 准备MCP调用
      const messages = [
        { role: 'user', content: 'Please execute print("Hello World")' }
      ];

      const preparedCall = await mcpHelper.prepareMcpCall(messages);

      expect(preparedCall).toBeDefined();
      expect(preparedCall!.server.name).toBe(serverConfig.name);
      expect(preparedCall!.messages).toHaveLength(2); // 系统消息 + 用户消息
      
      // 验证系统消息包含工具描述
      const systemMessage = preparedCall!.messages[0];
      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('execute_python');
      expect(systemMessage.content).toContain('read_file');
    });

    it('should return null when no active server', async () => {
      // 确保没有激活的服务器
      const activeServer = await mcpRepository.getActiveServer();
      expect(activeServer).toBeNull();

      const result = await mcpHelper.prepareMcpCall([
        { role: 'user', content: 'test message' }
      ]);

      expect(result).toBeNull();
    });
  });

  describe('MCP Server Connection Testing', () => {
    it('should test HTTP server connection', async () => {
      // 创建HTTP服务器配置
      const serverConfig = {
        name: 'HTTP Test Server',
        transport: 'http' as const,
        baseUrl: 'http://httpbin.org/status/200', // 使用公共测试端点
        isActive: false
      };

      const server = await mcpRepository.createServer(serverConfig);

      // 测试连接
      const testResult = await mcpHelper.testServerConnection(server);

      expect(testResult.success).toBe(true);
      expect(testResult.message).toContain('200');
      expect(testResult.details).toBeDefined();
      expect(testResult.details.statusCode).toBe(200);
    });

    it('should detect failed HTTP connection', async () => {
      // 创建指向不存在端点的服务器配置
      const serverConfig = {
        name: 'Failed HTTP Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:99999', // 不存在的端口
        isActive: false
      };

      const server = await mcpRepository.createServer(serverConfig);

      // 测试连接
      const testResult = await mcpHelper.testServerConnection(server);

      expect(testResult.success).toBe(false);
      expect(testResult.message).toContain('Connection failed');
    });

    it('should validate stdio command format', async () => {
      // 创建stdio服务器配置
      const serverConfig = {
        name: 'Stdio Test Server',
        transport: 'stdio' as const,
        command: 'python /usr/bin/valid-script.py',
        isActive: false
      };

      const server = await mcpRepository.createServer(serverConfig);

      // 测试连接（验证命令格式）
      const testResult = await mcpHelper.testServerConnection(server);

      expect(testResult.success).toBe(true);
      expect(testResult.message).toBe('Command format is valid');
      expect(testResult.details.executable).toBe('python');
    });

    it('should reject dangerous stdio commands', async () => {
      // 创建包含危险命令的服务器配置
      const serverConfig = {
        name: 'Dangerous Stdio Server',
        transport: 'stdio' as const,
        command: 'rm -rf /important-data',
        isActive: false
      };

      await expect(mcpRepository.createServer(serverConfig)).rejects.toThrow(
        'Command contains dangerous characters or patterns'
      );
    });
  });

  describe('MCP Server Statistics', () => {
    it('should provide accurate server statistics', async () => {
      // 创建多个服务器
      const servers = [
        {
          name: 'Server 1',
          transport: 'http' as const,
          baseUrl: 'http://localhost:3001',
          isActive: false
        },
        {
          name: 'Server 2',
          transport: 'websocket' as const,
          baseUrl: 'ws://localhost:3002',
          isActive: false
        },
        {
          name: 'Server 3',
          transport: 'stdio' as const,
          command: 'python /path/to/server.py',
          isActive: false
        }
      ];

      for (const config of servers) {
        await mcpRepository.createServer(config);
      }

      // 激活其中一个
      const allServers = await mcpRepository.listServers();
      await mcpRepository.activateServer(allServers[1].id);

      // 获取统计信息
      const stats = await mcpRepository.getActiveServerStats();

      expect(stats.hasActive).toBe(true);
      expect(stats.server).toBeDefined();
      expect(stats.server!.name).toBe('Server 2');
      expect(stats.totalCount).toBe(3);
    });
  });
});

/**
 * MCP服务器生命周期测试
 * 测试完整的MCP服务器生命周期管理
 */
describe('MCP Server Lifecycle', () => {
  let prisma: PrismaClient;
  let mcpRepository: McpRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    mcpRepository = new McpRepository(prisma);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await prisma.mcpServerConfig.deleteMany({});
    await prisma.$disconnect();
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    await prisma.mcpServerConfig.deleteMany({});
  });

  it('should handle complete server lifecycle', async () => {
    // 1. 创建服务器
    const serverConfig = {
      name: 'Lifecycle Test Server',
      transport: 'http' as const,
      baseUrl: 'http://localhost:3000',
      apiKey: 'lifecycle-test-key',
      config: {
        tools: [{
          name: 'test_tool',
          description: 'Test tool for lifecycle',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            }
          }
        }]
      },
      isActive: false
    };

    const server = await mcpRepository.createServer(serverConfig);
    expect(server.isActive).toBe(false);

    // 2. 更新服务器配置
    const updatedServer = await mcpRepository.updateServer(server.id, {
      name: 'Updated Lifecycle Server',
      baseUrl: 'http://localhost:8080'
    });
    expect(updatedServer.name).toBe('Updated Lifecycle Server');
    expect(updatedServer.baseUrl).toBe('http://localhost:8080');

    // 3. 激活服务器
    const activatedServer = await mcpRepository.activateServer(server.id);
    expect(activatedServer.isActive).toBe(true);

    // 4. 验证激活状态
    const activeServer = await mcpRepository.getActiveServer();
    expect(activeServer).toBeDefined();
    expect(activeServer!.id).toBe(server.id);

    // 5. 创建另一个服务器并激活（应该自动停用之前的）
    const secondServerConfig = {
      name: 'Second Lifecycle Server',
      transport: 'websocket' as const,
      baseUrl: 'ws://localhost:3001',
      isActive: false
    };

    const secondServer = await mcpRepository.createServer(secondServerConfig);
    await mcpRepository.activateServer(secondServer.id);

    // 验证第一个服务器被停用
    const firstServerAfterDeactivation = await mcpRepository.getServerById(server.id);
    expect(firstServerAfterDeactivation!.isActive).toBe(false);

    // 验证第二个服务器是激活的
    const currentActiveServer = await mcpRepository.getActiveServer();
    expect(currentActiveServer!.id).toBe(secondServer.id);

    // 6. 删除非激活的服务器
    await mcpRepository.deleteServer(server.id);
    
    const deletedServer = await mcpRepository.getServerById(server.id);
    expect(deletedServer).toBeNull();

    // 7. 验证不能删除激活的服务器
    await expect(mcpRepository.deleteServer(secondServer.id)).rejects.toThrow(
      'Cannot delete active MCP server. Please deactivate it first.'
    );
  });
});