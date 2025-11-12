/**
 * 验证模式定义
 * 用于请求验证、输入清理和安全检查
 */

import { z } from 'zod';

// 基础MCP服务器模式
export const mcpServerBaseSchema = z.object({
  name: z.string(),
  transport: z.enum(['stdio', 'http', 'websocket']),
  command: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  config: z.object({}).passthrough().optional()
});

// 创建MCP服务器模式
export const createMcpServerSchema = mcpServerBaseSchema;

// 更新MCP服务器模式（所有字段可选）
export const updateMcpServerSchema = mcpServerBaseSchema.partial();

// MCP服务器查询模式
export const mcpServerQuerySchema = z.object({
  includeInactive: z.string().optional()
});

// 基础provider模式
export const providerBaseSchema = z.object({
  name: z.string(),
  type: z.enum(['openai', 'anthropic', 'google', 'ollama', 'custom']),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  isCustom: z.boolean().optional(),
  config: z.object({}).passthrough().optional()
});

// 创建provider模式
export const createProviderSchema = providerBaseSchema;

// 更新provider模式
export const updateProviderSchema = providerBaseSchema.partial();

// 模型模式
export const modelSchema = z.object({
  name: z.string(),
  model: z.string(),
  providerId: z.string(),
  config: z.object({}).passthrough().optional()
});

// 创建模型模式
export const createModelSchema = modelSchema;

// 更新模型模式
export const updateModelSchema = modelSchema.partial();

// 用户偏好模式
export const userPreferenceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  notifications: z.boolean().optional(),
  compactView: z.boolean().optional(),
  showTimestamps: z.boolean().optional(),
  autoSave: z.boolean().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional()
});

// 用户认证模式
export const authSchema = z.object({
  email: z.string(),
  password: z.string()
});

// 用户注册模式
export const registerSchema = authSchema.extend({
  name: z.string()
});

// 聊天消息模式
export const chatMessageSchema = z.object({
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  sessionId: z.string().optional()
});

// 聊天会话模式
export const chatSessionSchema = z.object({
  title: z.string().optional(),
  modelId: z.string().optional()
});

// 分页参数验证
export const paginationSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional()
});