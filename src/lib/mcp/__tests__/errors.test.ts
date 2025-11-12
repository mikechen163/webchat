/**
 * MCP错误处理单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  McpServerError,
  createMcpError,
  createValidationError,
  createPermissionError,
  createServerUnavailableError,
  createToolExecutionError,
  MCP_ERROR_CODES
} from '../errors';

describe('MCP Errors', () => {
  describe('McpServerError', () => {
    it('should create error with basic properties', () => {
      const error = new McpServerError(
        'Test error message',
        MCP_ERROR_CODES.SERVER_NOT_FOUND,
        404
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(McpServerError);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(MCP_ERROR_CODES.SERVER_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
    });

    it('should create retryable error', () => {
      const error = new McpServerError(
        'Timeout error',
        MCP_ERROR_CODES.TIMEOUT,
        408,
        undefined,
        true
      );

      expect(error.retryable).toBe(true);
    });

    it('should serialize to JSON', () => {
      const error = new McpServerError(
        'Test error',
        MCP_ERROR_CODES.TRANSPORT_ERROR,
        500,
        { detail: 'some detail' }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'McpServerError',
        code: MCP_ERROR_CODES.TRANSPORT_ERROR,
        message: 'Test error',
        statusCode: 500,
        details: { detail: 'some detail' },
        retryable: false
      });
    });
  });

  describe('createMcpError', () => {
    it('should handle McpServerError instances', () => {
      const originalError = new McpServerError(
        'Original error',
        MCP_ERROR_CODES.SERVER_NOT_FOUND,
        404
      );

      const result = createMcpError(originalError);

      expect(result).toBe(originalError);
    });

    it('should handle ENOENT errors', () => {
      const originalError = new Error('ENOENT: no such file or directory');

      const result = createMcpError(originalError, 'Command execution');

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.SERVER_NOT_FOUND);
      expect(result.statusCode).toBe(404);
      expect(result.message).toBe('Command execution: Command not found');
    });

    it('should handle timeout errors', () => {
      const originalError = new Error('Operation timeout');

      const result = createMcpError(originalError);

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.TIMEOUT);
      expect(result.statusCode).toBe(408);
      expect(result.retryable).toBe(true);
    });

    it('should handle connection errors', () => {
      const originalError = new Error('ECONNREFUSED');

      const result = createMcpError(originalError);

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.CONNECTION_FAILED);
      expect(result.statusCode).toBe(503);
      expect(result.retryable).toBe(true);
    });

    it('should handle string errors', () => {
      const result = createMcpError('String error message');

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.TRANSPORT_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('String error message');
    });

    it('should handle unknown error types', () => {
      const result = createMcpError({ custom: 'error' }, 'Custom context');

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.TRANSPORT_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Custom context: Unknown MCP server error');
      expect(result.details).toEqual({ custom: 'error' });
    });
  });

  describe('createValidationError', () => {
    it('should create validation error', () => {
      const result = createValidationError('Invalid input', { field: 'name' });

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.VALIDATION_ERROR);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Invalid input');
      expect(result.details).toEqual({ field: 'name' });
    });
  });

  describe('createPermissionError', () => {
    it('should create permission error with custom message', () => {
      const result = createPermissionError('Admin access required');

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.PERMISSION_DENIED);
      expect(result.statusCode).toBe(403);
      expect(result.message).toBe('Admin access required');
    });

    it('should create permission error with default message', () => {
      const result = createPermissionError();

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.PERMISSION_DENIED);
      expect(result.statusCode).toBe(403);
      expect(result.message).toBe('Permission denied');
    });
  });

  describe('createServerUnavailableError', () => {
    it('should create server unavailable error with server name', () => {
      const result = createServerUnavailableError('Test Server');

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.SERVER_UNAVAILABLE);
      expect(result.statusCode).toBe(503);
      expect(result.message).toBe('MCP server "Test Server" is not available');
      expect(result.retryable).toBe(true);
    });

    it('should create server unavailable error without server name', () => {
      const result = createServerUnavailableError();

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.SERVER_UNAVAILABLE);
      expect(result.statusCode).toBe(503);
      expect(result.message).toBe('MCP server is not available');
      expect(result.retryable).toBe(true);
    });
  });

  describe('createToolExecutionError', () => {
    it('should create tool execution error with Error object', () => {
      const toolError = new Error('Python syntax error');
      const result = createToolExecutionError('execute_python', toolError);

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.TOOL_EXECUTION_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Tool "execute_python" execution failed: Python syntax error');
      expect(result.details).toEqual({
        toolName: 'execute_python',
        originalError: 'Python syntax error'
      });
    });

    it('should create tool execution error with string', () => {
      const result = createToolExecutionError('list_dir', 'Directory not found');

      expect(result).toBeInstanceOf(McpServerError);
      expect(result.code).toBe(MCP_ERROR_CODES.TOOL_EXECUTION_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Tool "list_dir" execution failed: Directory not found');
      expect(result.details).toEqual({
        toolName: 'list_dir',
        originalError: 'Directory not found'
      });
    });
  });
});