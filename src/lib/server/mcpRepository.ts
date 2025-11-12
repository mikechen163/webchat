/**
 * MCP服务器配置数据访问层
 * 提供MCP服务器配置的CRUD操作和激活管理
 */

import { PrismaClient } from '@prisma/client';
import type { McpServerConfig } from '$lib/mcp/types';
import { MCP_ERROR_CODES } from '$lib/mcp/types';
import { createMcpError, McpServerError } from '$lib/mcp/errors';

export class McpRepository {
  constructor(private prisma: PrismaClient) {}
  
  /**
   * 创建MCP服务器配置
   */
  async createServer(config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<McpServerConfig> {
    try {
      // 验证名称唯一性
      const existing = await this.prisma.mcpServerConfig.findUnique({
        where: { name: config.name }
      });
      
      if (existing) {
        throw new McpServerError(
          `MCP server with name "${config.name}" already exists`,
          MCP_ERROR_CODES.VALIDATION_ERROR,
          409
        );
      }
      
      // 验证传输方式和对应字段
      this.validateTransportConfig(config);
      
      // 序列化config字段
      const serializedConfig = config.config ? JSON.stringify(config.config) : null;
      
      return await this.prisma.mcpServerConfig.create({
        data: {
          name: config.name,
          transport: config.transport,
          command: config.command,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          config: serializedConfig,
          isActive: config.isActive
        }
      });
    } catch (error) {
      if (error instanceof McpServerError) {
        throw error;
      }
      throw createMcpError(error, 'Failed to create MCP server');
    }
  }
  
  /**
   * 获取激活的MCP服务器
   */
  async getActiveServer(): Promise<McpServerConfig | null> {
    try {
      const server = await this.prisma.mcpServerConfig.findFirst({
        where: { isActive: true }
      });
      
      if (!server) {
        return null;
      }
      
      return this.deserializeServer(server);
    } catch (error) {
      throw createMcpError(error, 'Failed to get active MCP server');
    }
  }
  
  /**
   * 激活指定的MCP服务器（事务处理）
   */
  async activateServer(id: string): Promise<McpServerConfig> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 验证服务器存在
        const server = await tx.mcpServerConfig.findUnique({
          where: { id }
        });
        
        if (!server) {
          throw new McpServerError(
            `MCP server with ID "${id}" not found`,
            MCP_ERROR_CODES.SERVER_NOT_FOUND,
            404
          );
        }
        
        // 先停用所有服务器
        await tx.mcpServerConfig.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });
        
        // 激活指定服务器
        const activatedServer = await tx.mcpServerConfig.update({
          where: { id },
          data: { isActive: true }
        });
        
        return this.deserializeServer(activatedServer);
      });
    } catch (error) {
      if (error instanceof McpServerError) {
        throw error;
      }
      throw createMcpError(error, 'Failed to activate MCP server');
    }
  }
  
  /**
   * 根据ID获取MCP服务器
   */
  async getServerById(id: string): Promise<McpServerConfig | null> {
    try {
      const server = await this.prisma.mcpServerConfig.findUnique({
        where: { id }
      });
      
      if (!server) {
        return null;
      }
      
      return this.deserializeServer(server);
    } catch (error) {
      throw createMcpError(error, 'Failed to get MCP server by ID');
    }
  }
  
  /**
   * 根据名称获取MCP服务器
   */
  async getServerByName(name: string): Promise<McpServerConfig | null> {
    try {
      const server = await this.prisma.mcpServerConfig.findUnique({
        where: { name }
      });
      
      if (!server) {
        return null;
      }
      
      return this.deserializeServer(server);
    } catch (error) {
      throw createMcpError(error, 'Failed to get MCP server by name');
    }
  }
  
  /**
   * 更新MCP服务器配置
   */
  async updateServer(id: string, data: Partial<McpServerConfig>): Promise<McpServerConfig> {
    try {
      // 验证服务器存在
      const existing = await this.prisma.mcpServerConfig.findUnique({
        where: { id }
      });
      
      if (!existing) {
        throw new McpServerError(
          `MCP server with ID "${id}" not found`,
          MCP_ERROR_CODES.SERVER_NOT_FOUND,
          404
        );
      }
      
      // 验证传输方式和对应字段
      if (data.transport || data.command || data.baseUrl) {
        this.validateTransportConfig({ ...existing, ...data });
      }
      
      // 序列化config字段
      const updateData: any = { ...data };
      if (data.config !== undefined) {
        updateData.config = data.config ? JSON.stringify(data.config) : null;
      }
      
      const updated = await this.prisma.mcpServerConfig.update({
        where: { id },
        data: updateData
      });
      
      return this.deserializeServer(updated);
    } catch (error) {
      if (error instanceof McpServerError) {
        throw error;
      }
      throw createMcpError(error, 'Failed to update MCP server');
    }
  }
  
  /**
   * 删除MCP服务器
   */
  async deleteServer(id: string): Promise<void> {
    try {
      // 验证服务器存在
      const existing = await this.prisma.mcpServerConfig.findUnique({
        where: { id }
      });
      
      if (!existing) {
        throw new McpServerError(
          `MCP server with ID "${id}" not found`,
          MCP_ERROR_CODES.SERVER_NOT_FOUND,
          404
        );
      }
      
      // 检查是否为激活状态
      if (existing.isActive) {
        throw new McpServerError(
          'Cannot delete active MCP server. Please deactivate it first.',
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
      
      await this.prisma.mcpServerConfig.delete({
        where: { id }
      });
    } catch (error) {
      if (error instanceof McpServerError) {
        throw error;
      }
      throw createMcpError(error, 'Failed to delete MCP server');
    }
  }
  
  /**
   * 获取所有MCP服务器列表
   */
  async listServers(): Promise<McpServerConfig[]> {
    try {
      const servers = await this.prisma.mcpServerConfig.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      return servers.map(server => this.deserializeServer(server));
    } catch (error) {
      throw createMcpError(error, 'Failed to list MCP servers');
    }
  }
  
  /**
   * 获取激活服务器的统计信息
   */
  async getActiveServerStats(): Promise<{ 
    hasActive: boolean; 
    server?: McpServerConfig; 
    totalCount: number 
  }> {
    try {
      const [activeServer, totalCount] = await Promise.all([
        this.getActiveServer(),
        this.prisma.mcpServerConfig.count()
      ]);
      
      return {
        hasActive: !!activeServer,
        server: activeServer || undefined,
        totalCount
      };
    } catch (error) {
      throw createMcpError(error, 'Failed to get MCP server statistics');
    }
  }
  
  /**
   * 验证传输方式配置
   */
  private validateTransportConfig(config: Partial<McpServerConfig>): void {
    const { transport, command, baseUrl } = config;
    
    if (!transport) {
      throw new McpServerError(
        'Transport type is required',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    switch (transport) {
      case 'stdio':
        if (!command || command.trim() === '') {
          throw new McpServerError(
            'Command is required for stdio transport',
            MCP_ERROR_CODES.VALIDATION_ERROR,
            400
          );
        }
        break;
        
      case 'http':
      case 'websocket':
        if (!baseUrl || baseUrl.trim() === '') {
          throw new McpServerError(
            'Base URL is required for HTTP/WebSocket transport',
            MCP_ERROR_CODES.VALIDATION_ERROR,
            400
          );
        }
        
        // 验证URL格式
        try {
          const url = new URL(baseUrl);
          if (transport === 'websocket' && !url.protocol.startsWith('ws')) {
            throw new McpServerError(
              'WebSocket transport requires ws:// or wss:// protocol',
              MCP_ERROR_CODES.VALIDATION_ERROR,
              400
            );
          }
        } catch (urlError) {
          throw new McpServerError(
            'Invalid base URL format',
            MCP_ERROR_CODES.VALIDATION_ERROR,
            400
          );
        }
        break;
        
      default:
        throw new McpServerError(
          `Unsupported transport type: ${transport}`,
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
    }
  }
  
  /**
   * 反序列化服务器配置（处理JSON字符串）
   */
  private deserializeServer(server: any): McpServerConfig {
    return {
      ...server,
      config: server.config ? JSON.parse(server.config) : undefined
    };
  }
}