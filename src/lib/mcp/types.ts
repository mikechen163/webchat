/**
 * MCP (Model Coordination Protocol) 类型定义
 * 支持用户自定义MCP服务器的配置和管理
 */

// MCP传输方式类型（对应数据库中的字符串值）
export type McpTransport = 'stdio' | 'http' | 'websocket';

// MCP服务器配置接口
export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  command?: string;        // for stdio transport
  baseUrl?: string;        // for http/websocket transport
  apiKey?: string;         // optional auth (encrypted)
  config?: McpToolConfig;  // tool configurations
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// MCP工具配置
export interface McpToolConfig {
  tools?: McpTool[];
  capabilities?: McpCapabilities;
  metadata?: Record<string, any>;
}

// MCP工具定义
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: string;
    properties: Record<string, any>;
  };
}

// MCP能力定义
export interface McpCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

// MCP消息格式
export interface McpMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: McpToolCall[];
  toolResults?: McpToolResult[];
}

// MCP工具调用
export interface McpToolCall {
  id: string;
  type: 'tool';
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

// MCP工具结果
export interface McpToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}

// MCP提供商配置（用于适配器）
export interface McpProviderConfig {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string | null;
  wsPath?: string | null;
  serverConfig?: McpServerConfig;
}

// MCP请求载荷
export interface McpRequest {
  messages: McpMessage[];
  stream?: boolean;
  tools?: McpTool[];
  temperature?: number;
  maxTokens?: number;
}

// MCP响应格式
export interface McpResponse {
  success: boolean;
  data?: any;
  error?: McpError;
  messages?: McpMessage[];
}

// MCP错误定义
export interface McpError {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
}

// 自定义MCP提供商配置
export interface CustomMcpProviderConfig {
  serverConfig: McpServerConfig;
  messages: McpMessage[];
}

// MCP传输接口
export interface McpTransport {
  initialize(): Promise<void>;
  sendMessage(message: any): Promise<any>;
  cleanup?(): Promise<void>;
  isHealthy?(): boolean;
}

// MCP错误代码枚举
export const MCP_ERROR_CODES = {
  // 服务器相关错误
  SERVER_NOT_FOUND: 'SERVER_NOT_FOUND',
  SERVER_NOT_ACTIVE: 'SERVER_NOT_ACTIVE',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  
  // 传输相关错误
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  
  // 工具相关错误
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',
  INVALID_TOOL_PARAMS: 'INVALID_TOOL_PARAMS',
  
  // 验证相关错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  
  // 权限相关错误
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED'
} as const;

export type McpErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES];