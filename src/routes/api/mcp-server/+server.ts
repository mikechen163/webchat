/**
 * MCP服务器管理API
 * 提供MCP服务器的CRUD操作
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { McpRepository } from '$lib/server/mcpRepository';
import { encryptApiKey, maskApiKey } from '$lib/server/crypto';
import { createMcpError, McpServerError } from '$lib/mcp/errors';

const prisma = new PrismaClient();
const mcpRepository = new McpRepository(prisma);

// 移除敏感信息的辅助函数
function sanitizeServer(server: any) {
  const { apiKey, ...safeData } = server;
  return {
    ...safeData,
    hasApiKey: !!apiKey,
    apiKey: apiKey ? maskApiKey(apiKey) : undefined
  };
}

/**
 * GET /api/mcp-server - 获取MCP服务器列表
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // 简化权限验证 - 检查是否有用户
    if (!locals.auth?.user) {
      return json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }
    
    // 检查管理员权限
    if (locals.auth.user.role !== 'admin') {
      return json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin privileges required'
        }
      }, { status: 403 });
    }
    
    // 解析查询参数
    const searchParams = url.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    
    // 获取服务器列表
    let servers = await mcpRepository.listServers();
    
    // 如果不包含非激活服务器，只返回激活的
    if (!includeInactive) {
      servers = servers.filter(server => server.isActive);
    }
    
    // 应用数量限制
    if (limit && limit > 0) {
      servers = servers.slice(0, limit);
    }
    
    // 移除敏感信息并返回
    const safeServers = servers.map(sanitizeServer);
    
    return json({
      success: true,
      data: safeServers,
      count: safeServers.length
    });
    
  } catch (error) {
    console.error('Failed to list MCP servers:', error);
    
    if (error instanceof McpServerError) {
      throw error;
    }
    
    throw createMcpError(error, 'Failed to list MCP servers');
  }
};

/**
 * POST /api/mcp-server - 创建新的MCP服务器
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // 简化权限验证
    if (!locals.auth?.user || locals.auth.user.role !== 'admin') {
      return json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin privileges required'
        }
      }, { status: 403 });
    }
    
    // 解析和验证请求体
    const body = await request.json();
    
    // 基本验证
    if (!body.name || !body.transport) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name and transport are required'
        }
      }, { status: 400 });
    }
    
    // 验证传输类型
    const validTransports = ['http', 'websocket', 'stdio'];
    if (!validTransports.includes(body.transport)) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transport type'
        }
      }, { status: 400 });
    }
    
    // 验证传输特定字段
    if (body.transport === 'stdio' && !body.command) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Command is required for stdio transport'
        }
      }, { status: 400 });
    }
    
    if (body.transport !== 'stdio' && !body.baseUrl) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Base URL is required for http/websocket transport'
        }
      }, { status: 400 });
    }
    
    // 加密API密钥
    let encryptedApiKey: string | undefined;
    if (body.apiKey) {
      encryptedApiKey = encryptApiKey(body.apiKey);
    }
    
    // 序列化config
    let serializedConfig: string | undefined;
    if (body.config) {
      serializedConfig = JSON.stringify(body.config);
    }
    
    // 创建服务器配置
    const server = await mcpRepository.createServer({
      name: body.name.trim(),
      transport: body.transport,
      command: body.command,
      baseUrl: body.baseUrl,
      apiKey: encryptedApiKey,
      config: serializedConfig,
      isActive: false // 新创建的服务器默认非激活
    });
    
    // 返回数据（移除敏感信息）
    const safeServer = sanitizeServer(server);
    
    return json({
      success: true,
      data: safeServer,
      message: 'MCP server created successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Failed to create MCP server:', error);
    
    if (error instanceof z.ZodError) {
      return json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors
        }
      }, { status: 400 });
    }
    
    if (error instanceof McpServerError) {
      throw error;
    }
    
    throw createMcpError(error, 'Failed to create MCP server');
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
};