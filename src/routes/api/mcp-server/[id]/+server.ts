/**
 * 单个MCP服务器管理API
 * 提供获取、更新、删除特定MCP服务器的功能
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { McpRepository } from '$lib/server/mcpRepository';
import { requireAdmin } from '$lib/server/auth';
import { updateMcpServerSchema } from '$lib/server/validation';
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
 * GET /api/mcp-server/:id - 获取特定MCP服务器
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    // 权限验证 - 需要管理员权限
    requireAdmin(locals);
    
    // 获取服务器
    const server = await mcpRepository.getServerById(params.id);
    
    if (!server) {
      throw new McpServerError(
        `MCP server with ID "${params.id}" not found`,
        'SERVER_NOT_FOUND',
        404
      );
    }
    
    // 返回数据（移除敏感信息）
    const safeServer = sanitizeServer(server);
    
    return json({
      success: true,
      data: safeServer
    });
    
  } catch (error) {
    console.error(`Failed to get MCP server ${params.id}:`, error);
    
    if (error instanceof McpServerError) {
      throw error;
    }
    
    throw createMcpError(error, `Failed to get MCP server ${params.id}`);
  }
};

/**
 * PATCH /api/mcp-server/:id - 更新MCP服务器
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  try {
    // 权限验证 - 需要管理员权限
    requireAdmin(locals);
    
    // 解析和验证请求体
    const body = await request.json();
    const validatedData = updateMcpServerSchema.parse(body);
    
    // 加密API密钥（如果提供）
    let encryptedApiKey: string | undefined | null = validatedData.apiKey;
    if (validatedData.apiKey !== undefined) {
      encryptedApiKey = validatedData.apiKey ? encryptApiKey(validatedData.apiKey) : null;
    }
    
    // 准备更新数据
    const updateData = {
      ...validatedData,
      ...(encryptedApiKey !== undefined && { apiKey: encryptedApiKey })
    };
    
    // 更新服务器配置
    const server = await mcpRepository.updateServer(params.id, updateData);
    
    // 返回数据（移除敏感信息）
    const safeServer = sanitizeServer(server);
    
    return json({
      success: true,
      data: safeServer,
      message: 'MCP server updated successfully'
    });
    
  } catch (error) {
    console.error(`Failed to update MCP server ${params.id}:`, error);
    
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
    
    throw createMcpError(error, `Failed to update MCP server ${params.id}`);
  }
};

/**
 * DELETE /api/mcp-server/:id - 删除MCP服务器
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    // 权限验证 - 需要管理员权限
    requireAdmin(locals);
    
    // 删除服务器
    await mcpRepository.deleteServer(params.id);
    
    return json({
      success: true,
      message: 'MCP server deleted successfully'
    });
    
  } catch (error) {
    console.error(`Failed to delete MCP server ${params.id}:`, error);
    
    if (error instanceof McpServerError) {
      throw error;
    }
    
    throw createMcpError(error, `Failed to delete MCP server ${params.id}`);
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
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
};