/**
 * MCP适配器单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callMcpProvider, callCustomMcpProvider, validateMcpProviderConfig } from '../adapter';
import { MCP_ERROR_CODES } from '../types';
import { McpServerError } from '../errors';

// 模拟node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

// 模拟ws
vi.mock('ws', () => ({
  default: vi.fn()
}));

describe('MCP Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('callMcpProvider', () => {
    it('should handle mock responses', async () => {
      const result = await callMcpProvider(
        { baseUrl: 'mock-server' },
        [{ role: 'user', content: 'test' }]
      );

      expect(result.ok).toBe(true);
      expect(result.body).toBeDefined();
      expect(result.body.getReader).toBeDefined();
    });

    it('should validate provider config', async () => {
      expect(() => validateMcpProviderConfig({} as any)).toThrow(McpServerError);
      
      expect(() => validateMcpProviderConfig({ 
        baseUrl: 'invalid-url' 
      } as any)).toThrow(McpServerError);

      expect(() => validateMcpProviderConfig({ 
        baseUrl: 'http://localhost:3000' 
      } as any)).not.toThrow();
    });

    it('should handle WebSocket URLs', async () => {
      const mockWebSocket = vi.fn();
      vi.doMock('ws', () => ({ default: mockWebSocket }));

      const result = await callMcpProvider(
        { baseUrl: 'ws://localhost:3000' },
        [{ role: 'user', content: 'test' }]
      );

      expect(result.ok).toBe(true);
    });

    it('should handle HTTP URLs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined })
          })
        }
      });

      vi.doMock('node-fetch', () => ({ default: mockFetch }));

      const result = await callMcpProvider(
        { baseUrl: 'http://localhost:3000' },
        [{ role: 'user', content: 'test' }]
      );

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  describe('callCustomMcpProvider', () => {
    it('should handle custom MCP server with HTTP transport', async () => {
      const serverConfig = {
        id: 'test-server',
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined })
          })
        }
      });

      vi.doMock('node-fetch', () => ({ default: mockFetch }));

      const result = await callCustomMcpProvider(
        serverConfig,
        [{ role: 'user', content: 'test' }]
      );

      expect(result.ok).toBe(true);
    });

    it('should handle custom MCP server with WebSocket transport', async () => {
      const serverConfig = {
        id: 'test-server',
        name: 'Test Server',
        transport: 'websocket' as const,
        baseUrl: 'ws://localhost:3000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockWebSocket = vi.fn();
      vi.doMock('ws', () => ({ default: mockWebSocket }));

      const result = await callCustomMcpProvider(
        serverConfig,
        [{ role: 'user', content: 'test' }]
      );

      expect(result.ok).toBe(true);
    });

    it('should throw error for unsupported transport', async () => {
      const serverConfig = {
        id: 'test-server',
        name: 'Test Server',
        transport: 'unsupported' as any,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(callCustomMcpProvider(
        serverConfig,
        [{ role: 'user', content: 'test' }]
      )).rejects.toThrow(McpServerError);
    });

    it('should throw error for stdio transport (not implemented)', async () => {
      const serverConfig = {
        id: 'test-server',
        name: 'Test Server',
        transport: 'stdio' as const,
        command: 'python test.py',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await expect(callCustomMcpProvider(
        serverConfig,
        [{ role: 'user', content: 'test' }]
      )).rejects.toThrow(McpServerError);
    });
  });
});