/**
 * MCP助手类
 * 提供MCP服务器调用和工具集成功能
 */

import { McpRepository } from './mcpRepository';
import { callMcpProvider, callCustomMcpProvider, buildToolDescription } from '$lib/mcp/adapter';
import { createStdioTransport } from '$lib/mcp/transports/stdio';
import { MCP_ERROR_CODES } from '$lib/mcp/types';
import { McpServerError, createMcpError } from '$lib/mcp/errors';
import type { 
  McpServerConfig, 
  McpMessage, 
  McpTool,
  McpProviderConfig 
} from '$lib/mcp/types';
import { PrismaClient } from '@prisma/client';

export class McpHelper {
  constructor(
    private mcpRepository: McpRepository
  ) {}
  
  /**
   * 获取当前激活的MCP服务器配置
   */
  async getActiveMcpConfig(): Promise<McpServerConfig | null> {
    try {
      return await this.mcpRepository.getActiveServer();
    } catch (error) {
      throw createMcpError(error, 'Failed to get active MCP server');
    }
  }
  
  /**
   * 准备MCP调用
   * 构建包含工具描述的消息列表
   */
  async prepareMcpCall(messages: McpMessage[]): Promise<{
    server: McpServerConfig;
    messages: McpMessage[];
  } | null> {
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
  
  /**
   * 调用MCP服务器
   * 根据服务器配置选择合适的传输方式
   */
  async callMcpServer(
    serverConfig: McpServerConfig,
    messages: McpMessage[]
  ): Promise<{ ok: boolean; body: { getReader(): any } }> {
    try {
      switch (serverConfig.transport) {
        case 'http':
        case 'websocket':
          return await callCustomMcpProvider(serverConfig, messages);
          
        case 'stdio':
          return await this.callStdioMcp(serverConfig, messages);
          
        default:
          throw new McpServerError(
            `Unsupported transport: ${serverConfig.transport}`,
            MCP_ERROR_CODES.TRANSPORT_ERROR,
            400
          );
      }
    } catch (error) {
      if (error instanceof McpServerError) {
        throw error;
      }
      throw createMcpError(error, 'MCP server call failed');
    }
  }
  
  /**
   * 调用Stdio MCP服务器
   */
  private async callStdioMcp(
    serverConfig: McpServerConfig,
    messages: McpMessage[]
  ): Promise<{ ok: boolean; body: { getReader(): any } }> {
    const transport = createStdioTransport(serverConfig);
    
    try {
      // 初始化传输
      await transport.initialize();
      
      // 发送请求
      const response = await transport.sendMessage({
        messages,
        stream: true
      });
      
      // 转换为流式响应格式
      return this.convertToStreamResponse(response);
      
    } finally {
      // 清理资源
      await transport.cleanup();
    }
  }
  
  /**
   * 将响应转换为流式格式
   */
  private convertToStreamResponse(response: any): { ok: boolean; body: { getReader(): any } } {
    const encoder = new TextEncoder();
    
    // 模拟SSE格式的响应
    if (response.content) {
      const chunks = [
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: response.content } }] })}\n\n`),
        encoder.encode('data: [DONE]\n\n')
      ];
      
      let index = 0;
      return {
        ok: true,
        body: {
          getReader() {
            return {
              async read() {
                if (index >= chunks.length) {
                  return { done: true, value: undefined };
                }
                return { done: false, value: chunks[index++] };
              }
            };
          }
        }
      };
    }
    
    // 空响应
    return {
      ok: true,
      body: {
        getReader() {
          return {
            async read() {
              return { done: true, value: undefined };
            }
          };
        }
      }
    };
  }
  
  /**
   * 构建工具描述信息
   */
  private buildToolDescription(server: McpServerConfig): string {
    return buildToolDescription(server);
  }
  
  /**
   * 获取MCP服务器统计信息
   */
  async getServerStats() {
    try {
      return await this.mcpRepository.getActiveServerStats();
    } catch (error) {
      throw createMcpError(error, 'Failed to get MCP server statistics');
    }
  }
  
  /**
   * 验证MCP服务器配置
   */
  validateServerConfig(config: McpServerConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new McpServerError(
        'Server name is required',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    if (!config.transport) {
      throw new McpServerError(
        'Transport type is required',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    switch (config.transport) {
      case 'stdio':
        if (!config.command || config.command.trim().length === 0) {
          throw new McpServerError(
            'Command is required for stdio transport',
            MCP_ERROR_CODES.VALIDATION_ERROR,
            400
          );
        }
        break;
        
      case 'http':
      case 'websocket':
        if (!config.baseUrl || config.baseUrl.trim().length === 0) {
          throw new McpServerError(
            'Base URL is required for HTTP/WebSocket transport',
            MCP_ERROR_CODES.VALIDATION_ERROR,
            400
          );
        }
        break;
        
      default:
        throw new McpServerError(
          `Unsupported transport: ${config.transport}`,
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
    }
  }
  
  /**
   * 测试MCP服务器连接
   */
  async testServerConnection(serverConfig: McpServerConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      this.validateServerConfig(serverConfig);
      
      switch (serverConfig.transport) {
        case 'http':
        case 'websocket':
          return await this.testHttpConnection(serverConfig);
          
        case 'stdio':
          return await this.testStdioConnection(serverConfig);
          
        default:
          throw new McpServerError(
            `Unsupported transport: ${serverConfig.transport}`,
            MCP_ERROR_CODES.VALIDATION_ERROR,
            400
          );
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        details: error instanceof McpServerError ? error.toJSON() : { error: String(error) }
      };
    }
  }
  
  /**
   * 测试HTTP/WebSocket连接
   */
  private async testHttpConnection(serverConfig: McpServerConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    console.log('[testHttpConnection] 开始测试HTTP连接:', {
      name: serverConfig.name,
      baseUrl: serverConfig.baseUrl,
      hasApiKey: !!serverConfig.apiKey
    });
    
    if (!serverConfig.baseUrl) {
      throw new McpServerError(
        'Base URL is required for HTTP connection test',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[testHttpConnection] 请求超时，5秒未响应');
        controller.abort();
      }, 5000); // 5秒超时
      
      console.log('[testHttpConnection] 发送请求到:', serverConfig.baseUrl);
      const response = await fetch(serverConfig.baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(serverConfig.apiKey ? { 'Authorization': `Bearer ${serverConfig.apiKey}` } : {})
        },
        body: JSON.stringify({ 
          test: true,
          message: 'Connection test from MCP client'
        })
      });
      
      clearTimeout(timeoutId);
      console.log('[testHttpConnection] 收到响应:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      // 对于测试连接，2xx和3xx都认为是成功，4xx和5xx是失败
      const isSuccess = response.ok || (response.status >= 200 && response.status < 400);
      return {
        success: isSuccess,
        message: isSuccess ? 'Connection successful' : `HTTP ${response.status}: ${response.statusText}`,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
          method: 'POST'
        }
      };
    } catch (error) {
      console.log('[testHttpConnection] 请求异常:', error);
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timeout'
        };
      }
      
      throw createMcpError(error, 'HTTP connection test failed');
    }
  }
  
  /**
   * 测试Stdio连接
   */
  private async testStdioConnection(serverConfig: McpServerConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    if (!serverConfig.command) {
      throw new McpServerError(
        'Command is required for stdio connection test',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    // 对于stdio服务器，我们只能验证命令格式
    // 实际的健康检查需要启动进程，这可能会很昂贵
    try {
      // 简单的命令格式验证
      const commandParts = serverConfig.command.split(' ');
      const executable = commandParts[0];
      
      // 检查是否是允许的可执行文件
      const allowedExecutables = [
        'python', 'python3', 'node', 'npm', 'npx',
        '/usr/local/bin/', '/usr/bin/', '/bin/'
      ];
      
      const isAllowed = allowedExecutables.some(exe => 
        executable === exe || executable.startsWith(exe)
      );
      
      return {
        success: isAllowed,
        message: isAllowed ? 'Command format is valid' : 'Command executable not in allowed list',
        details: {
          executable: executable,
          fullCommand: serverConfig.command
        }
      };
    } catch (error) {
      throw createMcpError(error, 'Stdio connection test failed');
    }
  }
}

/**
 * 创建MCP助手实例的工厂函数
 */
export function createMcpHelper(): McpHelper {
  const prisma = new PrismaClient();
  const mcpRepository = new McpRepository(prisma);
  return new McpHelper(mcpRepository);
}