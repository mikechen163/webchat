/**
 * MCP服务器连接测试API
 * 测试MCP服务器的连接性和可用性
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { requireAdmin } from '$lib/server/auth';
import { createMcpHelper } from '$lib/server/mcpHelper';
import { createMcpError } from '$lib/mcp/errors';

// 测试请求schema
const testConnectionSchema = z.object({
  serverId: z.string().optional(),
  serverConfig: z.object({
    name: z.string(),
    transport: z.enum(['stdio', 'http', 'websocket']),
    command: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    config: z.any().optional()
  }).optional()
}).refine(
  (data) => {
    // 必须提供serverId或serverConfig中的一个
    return data.serverId || data.serverConfig;
  },
  {
    message: "Either serverId or serverConfig must be provided"
  }
);

const mcpHelper = createMcpHelper();

/**
 * POST /api/mcp-server/test - 测试MCP服务器连接
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // 权限验证 - 需要管理员权限
    requireAdmin(locals);
    
    // 解析和验证请求体
    const body = await request.json();
    const validatedData = testConnectionSchema.parse(body);
    
    let result;
    
    if (validatedData.serverId) {
      // 测试现有服务器配置
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const { McpRepository } = await import('$lib/server/mcpRepository');
      const mcpRepository = new McpRepository(prisma);
      
      const server = await mcpRepository.getServerById(validatedData.serverId);
      if (!server) {
        return json({
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `MCP server with ID "${validatedData.serverId}" not found`
          }
        }, { status: 404 });
      }
      
      console.log('[test API] 测试现有服务器:', server.name, '传输方式:', server.transport);
      result = await mcpHelper.testServerConnection(server);
      console.log('[test API] 测试结果:', result);
      
    } else if (validatedData.serverConfig) {
      console.log('[test API] 测试新配置:', validatedData.serverConfig.name, '传输方式:', validatedData.serverConfig.transport);
      // 测试新配置
      result = await mcpHelper.testServerConnection(validatedData.serverConfig);
      console.log('[test API] 新配置测试结果:', result);
    } else {
      return json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Either serverId or serverConfig must be provided'
        }
      }, { status: 400 });
    }
    
    console.log('[test API] 返回结果:', { success: result.success, message: result.message });
    return json({
      success: result.success,
      data: result
    });
    
  } catch (error) {
    console.error('[test API] 测试MCP服务器连接失败:', error);
    
    if (error instanceof z.ZodError) {
      console.error('[test API] 验证错误:', error.errors);
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors
        }
      }, { status: 400 });
    }
    
    throw createMcpError(error, 'Failed to test MCP server connection');
  }
};

/**
 * 处理OPTIONS请求（CORS预检）
 */
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
};