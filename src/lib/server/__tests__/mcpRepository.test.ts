/**
 * MCP仓库单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpRepository } from '../mcpRepository';
import { MCP_ERROR_CODES } from '$lib/mcp/types';
import { McpServerError } from '$lib/mcp/errors';

// 模拟PrismaClient
const mockPrisma = {
  mcpServerConfig: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  $transaction: vi.fn(async (callback) => {
    return callback(mockPrisma);
  })
};

describe('McpRepository', () => {
  let repository: McpRepository;

  beforeEach(() => {
    repository = new McpRepository(mockPrisma as any);
    vi.clearAllMocks();
  });

  describe('createServer', () => {
    it('should create a new MCP server', async () => {
      const serverData = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: false
      };

      const expectedResult = {
        id: 'test-id',
        ...serverData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.mcpServerConfig.create.mockResolvedValue(expectedResult);

      const result = await repository.createServer(serverData);

      expect(result).toEqual(expectedResult);
      expect(mockPrisma.mcpServerConfig.create).toHaveBeenCalledWith({
        data: {
          name: serverData.name,
          transport: serverData.transport,
          baseUrl: serverData.baseUrl,
          command: undefined,
          apiKey: undefined,
          config: null,
          isActive: false
        }
      });
    });

    it('should throw error if server name already exists', async () => {
      const serverData = {
        name: 'Existing Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: false
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue({
        id: 'existing-id',
        name: serverData.name
      });

      await expect(repository.createServer(serverData)).rejects.toThrow(McpServerError);
      await expect(repository.createServer(serverData)).rejects.toThrow(
        `MCP server with name "${serverData.name}" already exists`
      );
    });

    it('should validate transport configuration', async () => {
      const serverData = {
        name: 'Test Server',
        transport: 'stdio' as const,
        isActive: false
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(null);

      await expect(repository.createServer(serverData)).rejects.toThrow(McpServerError);
      await expect(repository.createServer(serverData)).rejects.toThrow(
        'Command is required for stdio transport'
      );
    });
  });

  describe('getActiveServer', () => {
    it('should return active server', async () => {
      const expectedServer = {
        id: 'active-id',
        name: 'Active Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: true,
        config: '{"tools": []}',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.mcpServerConfig.findFirst.mockResolvedValue(expectedServer);

      const result = await repository.getActiveServer();

      expect(result).toEqual({
        ...expectedServer,
        config: { tools: [] }
      });
      expect(mockPrisma.mcpServerConfig.findFirst).toHaveBeenCalledWith({
        where: { isActive: true }
      });
    });

    it('should return null if no active server', async () => {
      mockPrisma.mcpServerConfig.findFirst.mockResolvedValue(null);

      const result = await repository.getActiveServer();

      expect(result).toBeNull();
    });
  });

  describe('activateServer', () => {
    it('should activate server and deactivate others', async () => {
      const serverId = 'test-id';
      const server = {
        id: serverId,
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(server);
      mockPrisma.mcpServerConfig.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.mcpServerConfig.update.mockResolvedValue({
        ...server,
        isActive: true
      });

      const result = await repository.activateServer(serverId);

      expect(result.isActive).toBe(true);
      expect(mockPrisma.mcpServerConfig.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false }
      });
      expect(mockPrisma.mcpServerConfig.update).toHaveBeenCalledWith({
        where: { id: serverId },
        data: { isActive: true }
      });
    });

    it('should throw error if server not found', async () => {
      const serverId = 'non-existent';

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(null);

      await expect(repository.activateServer(serverId)).rejects.toThrow(McpServerError);
      await expect(repository.activateServer(serverId)).rejects.toThrow(
        `MCP server with ID "${serverId}" not found`
      );
    });
  });

  describe('updateServer', () => {
    it('should update server configuration', async () => {
      const serverId = 'test-id';
      const existingServer = {
        id: serverId,
        name: 'Existing Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updateData = {
        name: 'Updated Server',
        baseUrl: 'http://localhost:8080'
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(existingServer);
      mockPrisma.mcpServerConfig.update.mockResolvedValue({
        ...existingServer,
        ...updateData
      });

      const result = await repository.updateServer(serverId, updateData);

      expect(result.name).toBe(updateData.name);
      expect(result.baseUrl).toBe(updateData.baseUrl);
      expect(mockPrisma.mcpServerConfig.update).toHaveBeenCalledWith({
        where: { id: serverId },
        data: updateData
      });
    });

    it('should throw error if server not found', async () => {
      const serverId = 'non-existent';

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(null);

      await expect(repository.updateServer(serverId, { name: 'New Name' }))
        .rejects.toThrow(McpServerError);
    });
  });

  describe('deleteServer', () => {
    it('should delete inactive server', async () => {
      const serverId = 'test-id';
      const server = {
        id: serverId,
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(server);
      mockPrisma.mcpServerConfig.delete.mockResolvedValue(server);

      await repository.deleteServer(serverId);

      expect(mockPrisma.mcpServerConfig.delete).toHaveBeenCalledWith({
        where: { id: serverId }
      });
    });

    it('should throw error if server is active', async () => {
      const serverId = 'test-id';
      const server = {
        id: serverId,
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(server);

      await expect(repository.deleteServer(serverId)).rejects.toThrow(McpServerError);
      await expect(repository.deleteServer(serverId)).rejects.toThrow(
        'Cannot delete active MCP server. Please deactivate it first.'
      );
    });

    it('should throw error if server not found', async () => {
      const serverId = 'non-existent';

      mockPrisma.mcpServerConfig.findUnique.mockResolvedValue(null);

      await expect(repository.deleteServer(serverId)).rejects.toThrow(McpServerError);
    });
  });

  describe('listServers', () => {
    it('should return all servers ordered by creation date', async () => {
      const servers = [
        {
          id: '1',
          name: 'Server 1',
          transport: 'http' as const,
          baseUrl: 'http://localhost:3001',
          isActive: false,
          config: null,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        },
        {
          id: '2',
          name: 'Server 2',
          transport: 'websocket' as const,
          baseUrl: 'ws://localhost:3002',
          isActive: true,
          config: '{"tools": []}',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02')
        }
      ];

      mockPrisma.mcpServerConfig.findMany.mockResolvedValue(servers);

      const result = await repository.listServers();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2'); // Newer first
      expect(result[1].id).toBe('1');
      expect(mockPrisma.mcpServerConfig.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('getServerStats', () => {
    it('should return server statistics', async () => {
      const activeServer = {
        id: 'active-id',
        name: 'Active Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.mcpServerConfig.findFirst.mockResolvedValue(activeServer);
      mockPrisma.mcpServerConfig.count.mockResolvedValue(3);

      const result = await repository.getActiveServerStats();

      expect(result.hasActive).toBe(true);
      expect(result.server).toEqual(activeServer);
      expect(result.totalCount).toBe(3);
    });

    it('should handle no active server', async () => {
      mockPrisma.mcpServerConfig.findFirst.mockResolvedValue(null);
      mockPrisma.mcpServerConfig.count.mockResolvedValue(0);

      const result = await repository.getActiveServerStats();

      expect(result.hasActive).toBe(false);
      expect(result.server).toBeUndefined();
      expect(result.totalCount).toBe(0);
    });
  });
});