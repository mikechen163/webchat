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
    command?: string | null;     // Stdio: command to run (npx, python, etc.)
    args?: string | null;        // Stdio: JSON array of arguments
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
