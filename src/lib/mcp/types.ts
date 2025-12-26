/**
 * MCP (Model Context Protocol) Types
 */

export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}

export interface McpServerConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string | null;
    transport?: 'http' | 'ws' | 'stdio';
    tools?: McpTool[];
}

export interface McpToolCallResult {
    success: boolean;
    result?: any;
    error?: string;
}

export interface McpServerWithUserSelection extends McpServerConfig {
    description?: string;
    enabled: boolean;
    userEnabled: boolean;
    userMcpServerId?: string | null;
}
