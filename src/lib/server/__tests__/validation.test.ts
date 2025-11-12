/**
 * 输入验证单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  mcpServerConfigSchema,
  createMcpServerSchema,
  updateMcpServerSchema,
  requireAdmin,
  requireAuth
} from '../validation';

describe('Validation', () => {
  describe('mcpServerConfigSchema', () => {
    it('should validate valid HTTP server config', () => {
      const validConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000'
      };

      const result = mcpServerConfigSchema.parse(validConfig);

      expect(result).toEqual(validConfig);
    });

    it('should validate valid WebSocket server config', () => {
      const validConfig = {
        name: 'WebSocket Server',
        transport: 'websocket' as const,
        baseUrl: 'ws://localhost:3000'
      };

      const result = mcpServerConfigSchema.parse(validConfig);

      expect(result).toEqual(validConfig);
    });

    it('should validate valid stdio server config', () => {
      const validConfig = {
        name: 'Stdio Server',
        transport: 'stdio' as const,
        command: 'python /path/to/server.py'
      };

      const result = mcpServerConfigSchema.parse(validConfig);

      expect(result).toEqual(validConfig);
    });

    it('should reject HTTP config without baseUrl', () => {
      const invalidConfig = {
        name: 'Test Server',
        transport: 'http' as const
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject stdio config without command', () => {
      const invalidConfig = {
        name: 'Test Server',
        transport: 'stdio' as const
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid server name', () => {
      const invalidConfig = {
        name: 'Test<Server>',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000'
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject dangerous command', () => {
      const invalidConfig = {
        name: 'Test Server',
        transport: 'stdio' as const,
        command: 'rm -rf /'
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid URL', () => {
      const invalidConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'not-a-url'
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject WebSocket URL for HTTP transport', () => {
      const invalidConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'ws://localhost:3000'
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate with API key', () => {
      const validConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        apiKey: 'sk-test1234567890abcdef'
      };

      const result = mcpServerConfigSchema.parse(validConfig);

      expect(result.apiKey).toBe(validConfig.apiKey);
    });

    it('should validate with config JSON', () => {
      const validConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
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
        }
      };

      const result = mcpServerConfigSchema.parse(validConfig);

      expect(result.config).toEqual(validConfig.config);
    });

    it('should parse config from JSON string', () => {
      const validConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        config: '{"tools": [{"name": "test", "description": "Test tool"}]}'
      };

      const result = mcpServerConfigSchema.parse(validConfig);

      expect(result.config).toEqual({
        tools: [{ name: 'test', description: 'Test tool' }]
      });
    });

    it('should reject invalid config JSON', () => {
      const invalidConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000',
        config: 'invalid-json'
      };

      expect(() => mcpServerConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('createMcpServerSchema', () => {
    it('should require all fields', () => {
      const validConfig = {
        name: 'Test Server',
        transport: 'http' as const,
        baseUrl: 'http://localhost:3000'
      };

      const result = createMcpServerSchema.parse(validConfig);

      expect(result).toEqual(validConfig);
    });

    it('should reject partial config', () => {
      const invalidConfig = {
        name: 'Test Server'
      };

      expect(() => createMcpServerSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('updateMcpServerSchema', () => {
    it('should accept partial updates', () => {
      const updateData = {
        name: 'Updated Server'
      };

      const result = updateMcpServerSchema.parse(updateData);

      expect(result).toEqual(updateData);
    });

    it('should accept full updates', () => {
      const updateData = {
        name: 'Updated Server',
        transport: 'websocket' as const,
        baseUrl: 'ws://localhost:8080'
      };

      const result = updateMcpServerSchema.parse(updateData);

      expect(result).toEqual(updateData);
    });

    it('should reject empty updates', () => {
      const emptyUpdate = {};

      expect(() => updateMcpServerSchema.parse(emptyUpdate)).toThrow();
    });
  });

  describe('requireAdmin', () => {
    it('should not throw for admin role', () => {
      expect(() => requireAdmin('admin')).not.toThrow();
    });

    it('should throw for non-admin roles', () => {
      expect(() => requireAdmin('user')).toThrow('Admin privileges required');
      expect(() => requireAdmin('moderator')).toThrow('Admin privileges required');
    });
  });

  describe('requireAuth', () => {
    it('should return userId for valid input', () => {
      const userId = 'test-user-123';
      
      const result = requireAuth(userId);
      
      expect(result).toBe(userId);
    });

    it('should throw for undefined userId', () => {
      expect(() => requireAuth(undefined)).toThrow('Authentication required');
    });

    it('should throw for null userId', () => {
      expect(() => requireAuth(null as any)).toThrow('Authentication required');
    });

    it('should throw for empty userId', () => {
      expect(() => requireAuth('')).toThrow('Authentication required');
    });
  });
});