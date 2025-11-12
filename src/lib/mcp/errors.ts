/**
 * MCP错误处理类
 * 提供统一的错误定义和处理机制
 */

import { MCP_ERROR_CODES, type McpErrorCode } from './types';

export class McpServerError extends Error {
  constructor(
    message: string,
    public code: McpErrorCode,
    public statusCode: number = 500,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'McpServerError';
    
    // 维护堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, McpServerError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      retryable: this.retryable
    };
  }
}

// 错误工厂函数
export function createMcpError(
  error: unknown,
  context?: string
): McpServerError {
  
  // 如果已经是McpServerError，直接返回
  if (error instanceof McpServerError) {
    return error;
  }
  
  // 处理标准Error
  if (error instanceof Error) {
    // 进程相关错误
    if (error.message.includes('ENOENT')) {
      return new McpServerError(
        context ? `${context}: Command not found` : 'MCP server command not found',
        MCP_ERROR_CODES.SERVER_NOT_FOUND,
        404
      );
    }
    
    if (error.message.includes('EACCES')) {
      return new McpServerError(
        context ? `${context}: Permission denied` : 'MCP server permission denied',
        MCP_ERROR_CODES.PERMISSION_DENIED,
        403
      );
    }
    
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return new McpServerError(
        context ? `${context}: Operation timeout` : 'MCP server operation timeout',
        MCP_ERROR_CODES.TIMEOUT,
        408,
        undefined,
        true // timeout errors are retryable
      );
    }
    
    // 连接相关错误
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      return new McpServerError(
        context ? `${context}: Connection failed` : 'MCP server connection failed',
        MCP_ERROR_CODES.CONNECTION_FAILED,
        503,
        undefined,
        true // connection errors are retryable
      );
    }
    
    // 默认传输错误
    return new McpServerError(
      context ? `${context}: ${error.message}` : `MCP server error: ${error.message}`,
      MCP_ERROR_CODES.TRANSPORT_ERROR,
      500
    );
  }
  
  // 处理字符串错误
  if (typeof error === 'string') {
    return new McpServerError(
      context ? `${context}: ${error}` : error,
      MCP_ERROR_CODES.TRANSPORT_ERROR,
      500
    );
  }
  
  // 处理其他类型
  return new McpServerError(
    context ? `${context}: Unknown error` : 'Unknown MCP server error',
    MCP_ERROR_CODES.TRANSPORT_ERROR,
    500,
    error
  );
}

// 验证错误
export function createValidationError(
  message: string,
  details?: any
): McpServerError {
  return new McpServerError(
    message,
    MCP_ERROR_CODES.VALIDATION_ERROR,
    400,
    details
  );
}

// 权限错误
export function createPermissionError(
  message: string = 'Permission denied'
): McpServerError {
  return new McpServerError(
    message,
    MCP_ERROR_CODES.PERMISSION_DENIED,
    403
  );
}

// 服务器不可用错误
export function createServerUnavailableError(
  serverName?: string
): McpServerError {
  return new McpServerError(
    serverName ? `MCP server "${serverName}" is not available` : 'MCP server is not available',
    MCP_ERROR_CODES.SERVER_UNAVAILABLE,
    503,
    undefined,
    true // retryable
  );
}

// 工具执行错误
export function createToolExecutionError(
  toolName: string,
  error: unknown
): McpServerError {
  const message = error instanceof Error ? error.message : String(error);
  
  return new McpServerError(
    `Tool "${toolName}" execution failed: ${message}`,
    MCP_ERROR_CODES.TOOL_EXECUTION_ERROR,
    500,
    { toolName, originalError: message }
  );
}