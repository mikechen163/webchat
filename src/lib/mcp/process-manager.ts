/**
 * MCP Process Manager - Manages Stdio MCP Server processes
 * 
 * This module handles spawning, communicating with, and terminating
 * MCP servers that use stdio transport (local commands like npx, python).
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { McpTool } from './types';

// JSON-RPC 2.0 types
interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: Record<string, any>;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

interface McpProcess {
    id: string;
    process: ChildProcess;
    pendingRequests: Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
    }>;
    buffer: string;
    initialized: boolean;
}

interface StdioMcpConfig {
    id: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

/**
 * Singleton process manager for MCP stdio servers
 */
class McpProcessManager extends EventEmitter {
    private processes: Map<string, McpProcess> = new Map();
    private requestId: number = 0;
    private static instance: McpProcessManager;

    private constructor() {
        super();
    }

    static getInstance(): McpProcessManager {
        if (!McpProcessManager.instance) {
            McpProcessManager.instance = new McpProcessManager();
        }
        return McpProcessManager.instance;
    }

    /**
     * Spawn an MCP server process
     */
    async spawn(config: StdioMcpConfig): Promise<McpProcess> {
        // Check if already running
        const existing = this.processes.get(config.id);
        if (existing && !existing.process.killed) {
            return existing;
        }

        console.log(`[MCP] Spawning process: ${config.command} ${config.args.join(' ')}`);

        const proc = spawn(config.command, config.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            env: { ...process.env, ...config.env }
        });

        const mcpProcess: McpProcess = {
            id: config.id,
            process: proc,
            pendingRequests: new Map(),
            buffer: '',
            initialized: false
        };

        // Handle stdout data
        proc.stdout?.on('data', (data: Buffer) => {
            this.handleStdout(mcpProcess, data.toString());
        });

        // Handle stderr
        proc.stderr?.on('data', (data: Buffer) => {
            console.error(`[MCP ${config.id}] stderr:`, data.toString());
        });

        // Handle process exit
        proc.on('exit', (code, signal) => {
            console.log(`[MCP ${config.id}] Process exited with code ${code}, signal ${signal}`);
            this.processes.delete(config.id);
            // Reject all pending requests
            for (const [id, { reject }] of mcpProcess.pendingRequests) {
                reject(new Error(`Process exited unexpectedly`));
            }
            mcpProcess.pendingRequests.clear();
        });

        proc.on('error', (err) => {
            console.error(`[MCP ${config.id}] Process error:`, err);
        });

        this.processes.set(config.id, mcpProcess);

        // Initialize the MCP connection
        try {
            await this.initialize(mcpProcess);
            mcpProcess.initialized = true;
        } catch (err) {
            console.error(`[MCP ${config.id}] Failed to initialize:`, err);
            this.terminate(config.id);
            throw err;
        }

        return mcpProcess;
    }

    /**
     * Parse JSON-RPC responses from stdout
     */
    private handleStdout(mcpProcess: McpProcess, data: string) {
        mcpProcess.buffer += data;

        // Try to parse complete JSON-RPC messages
        // MCP uses newline-delimited JSON
        const lines = mcpProcess.buffer.split('\n');
        mcpProcess.buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                const response = JSON.parse(line) as JsonRpcResponse;
                const pending = mcpProcess.pendingRequests.get(response.id);

                if (pending) {
                    mcpProcess.pendingRequests.delete(response.id);
                    if (response.error) {
                        pending.reject(new Error(response.error.message));
                    } else {
                        pending.resolve(response.result);
                    }
                }
            } catch (err) {
                console.error(`[MCP ${mcpProcess.id}] Failed to parse response:`, line);
            }
        }
    }

    /**
     * Initialize MCP connection
     */
    private async initialize(mcpProcess: McpProcess): Promise<void> {
        const result = await this.sendRequest(mcpProcess, 'initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'webchat',
                version: '1.0.0'
            }
        });

        console.log(`[MCP ${mcpProcess.id}] Initialized:`, result);

        // Send initialized notification
        this.sendNotification(mcpProcess, 'notifications/initialized', {});
    }

    /**
     * Send JSON-RPC request and wait for response
     */
    async sendRequest(mcpProcess: McpProcess, method: string, params?: Record<string, any>): Promise<any> {
        const id = ++this.requestId;

        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                mcpProcess.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, 30000);

            mcpProcess.pendingRequests.set(id, {
                resolve: (value) => {
                    clearTimeout(timeout);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            const message = JSON.stringify(request) + '\n';
            mcpProcess.process.stdin?.write(message);
        });
    }

    /**
     * Send JSON-RPC notification (no response expected)
     */
    sendNotification(mcpProcess: McpProcess, method: string, params?: Record<string, any>): void {
        const notification = {
            jsonrpc: '2.0',
            method,
            params
        };
        mcpProcess.process.stdin?.write(JSON.stringify(notification) + '\n');
    }

    /**
     * List available tools from MCP server
     */
    async listTools(serverId: string): Promise<McpTool[]> {
        const mcpProcess = this.processes.get(serverId);
        if (!mcpProcess) {
            throw new Error(`MCP process not found: ${serverId}`);
        }

        const result = await this.sendRequest(mcpProcess, 'tools/list', {});
        return result?.tools || [];
    }

    /**
     * Call a tool on an MCP server
     */
    async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<any> {
        const mcpProcess = this.processes.get(serverId);
        if (!mcpProcess) {
            throw new Error(`MCP process not found: ${serverId}`);
        }

        const result = await this.sendRequest(mcpProcess, 'tools/call', {
            name: toolName,
            arguments: args
        });

        return result;
    }

    /**
     * Terminate an MCP process
     */
    terminate(serverId: string): void {
        const mcpProcess = this.processes.get(serverId);
        if (mcpProcess) {
            mcpProcess.process.kill();
            this.processes.delete(serverId);
        }
    }

    /**
     * Get a running process
     */
    getProcess(serverId: string): McpProcess | undefined {
        return this.processes.get(serverId);
    }

    /**
     * Check if a process is running
     */
    isRunning(serverId: string): boolean {
        const proc = this.processes.get(serverId);
        return proc !== undefined && !proc.process.killed;
    }

    /**
     * Terminate all processes
     */
    terminateAll(): void {
        for (const [id] of this.processes) {
            this.terminate(id);
        }
    }
}

// Export singleton instance
export const processManager = McpProcessManager.getInstance();
export type { StdioMcpConfig, McpProcess, JsonRpcRequest, JsonRpcResponse };
