/**
 * MCP服务器激活API
 * 提供激活特定MCP服务器的功能
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PrismaClient } from '@prisma/client';
import { McpRepository } from '$lib/server/mcpRepository';
import { requireAdmin } from '$lib/server/auth';
import { maskApiKey } from '$lib/server/crypto';
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
 * POST /api/mcp-server/:id/activate - 激活MCP服务器
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    // 权限验证 - 需要管理员权限
    requireAdmin(locals);
    
    // 激活服务器
    const server = await mcpRepository.activateServer(params.id);
    
    // 返回数据（移除敏感信息）
    const safeServer = sanitizeServer(server);
    
    return json({
      success: true,
      data: safeServer,
      message: `MCP server "${server.name}" activated successfully`
    });
    
  } catch (error) {
    console.error(`Failed to activate MCP server ${params.id}:`, error);
    
    if (error instanceof McpServerError) {
      throw error;
    }
    
    throw createMcpError(error, `Failed to activate MCP server ${params.id}`);
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