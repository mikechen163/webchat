/**
 * MCP服务器健康检查API
 * 检查当前激活的MCP服务器状态
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PrismaClient } from '@prisma/client';
import { McpRepository } from '$lib/server/mcpRepository';
import { requireAdmin } from '$lib/server/auth';
import { createMcpError, McpServerError } from '$lib/mcp/errors';

const prisma = new PrismaClient();
const mcpRepository = new McpRepository(prisma);

/**
 * GET /api/mcp-server/health - 获取MCP服务器健康状态
 */
export const GET: RequestHandler = async ({ locals }) => {
  try {
    // 权限验证 - 需要管理员权限
    requireAdmin(locals);
    
    // 获取激活的服务器状态
    const stats = await mcpRepository.getActiveServerStats();
    
    if (!stats.hasActive) {
      return json({
        success: true,
        data: {
          status: 'no_active_server',
          message: 'No MCP server is currently active',
          totalServers: stats.totalCount
        }
      });
    }
    
    // 执行健康检查
    const healthStatus = await performHealthCheck(stats.server!);
    
    return json({
      success: true,
      data: {
        status: healthStatus.status,
        server: {
          id: stats.server!.id,
          name: stats.server!.name,
          transport: stats.server!.transport
        },
        details: healthStatus.details,
        totalServers: stats.totalCount,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Failed to check MCP server health:', error);
    
    if (error instanceof McpServerError) {
      throw error;
    }
    
    throw createMcpError(error, 'Failed to check MCP server health');
  }
};

/**
 * 执行健康检查
 */
async function performHealthCheck(server: any): Promise<{
  status: 'healthy' | 'unhealthy' | 'unknown';
  details?: any;
}> {
  try {
    switch (server.transport) {
      case 'http':
      case 'websocket':
        return await checkHttpHealth(server);
        
      case 'stdio':
        return await checkStdioHealth(server);
        
      default:
        return {
          status: 'unknown',
          details: { message: 'Unknown transport type' }
        };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * 检查HTTP/WebSocket健康状态
 */
async function checkHttpHealth(server: any): Promise<{
  status: 'healthy' | 'unhealthy';
  details?: any;
}> {
  if (!server.baseUrl) {
    return {
      status: 'unhealthy',
      details: { message: 'No base URL configured' }
    };
  }
  
  try {
    // 尝试连接基础URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    const response = await fetch(server.baseUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: server.apiKey ? {
        'Authorization': `Bearer ${server.apiKey}`
      } : {}
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok || response.status < 500) {
      return {
        status: 'healthy',
        details: {
          message: 'Server is responding',
          statusCode: response.status,
          responseTime: Date.now() - controller.signal.timestamps?.start
        }
      };
    } else {
      return {
        status: 'unhealthy',
        details: {
          message: 'Server returned error status',
          statusCode: response.status,
          statusText: response.statusText
        }
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        status: 'unhealthy',
        details: { message: 'Connection timeout' }
      };
    }
    
    return {
      status: 'unhealthy',
      details: {
        message: 'Connection failed',
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * 检查Stdio健康状态
 */
async function checkStdioHealth(server: any): Promise<{
  status: 'healthy' | 'unhealthy';
  details?: any;
}> {
  if (!server.command) {
    return {
      status: 'unhealthy',
      details: { message: 'No command configured' }
    };
  }
  
  // 对于stdio服务器，我们只能验证命令格式
  // 实际的健康检查需要启动进程，这可能会很昂贵
  try {
    // 简单的命令格式验证
    const commandParts = server.command.split(' ');
    const executable = commandParts[0];
    
    // 检查是否是允许的可执行文件
    const allowedExecutables = [
      'python', 'python3', 'node', 'npm', 'npx',
      '/usr/local/bin/', '/usr/bin/', '/bin/'
    ];
    
    const isAllowed = allowedExecutables.some(exe => 
      executable === exe || executable.startsWith(exe)
    );
    
    if (!isAllowed) {
      return {
        status: 'unhealthy',
        details: {
          message: 'Command executable not in allowed list',
          executable: executable
        }
      };
    }
    
    return {
      status: 'healthy',
      details: {
        message: 'Command format is valid',
        executable: executable
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        message: 'Command validation failed',
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * 处理OPTIONS请求（CORS预检）
 */
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
};