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

        console.log(`[MCP ${config.id}] Spawning process: ${config.command} ${config.args.join(' ')}`);

        // Use direct spawn without shell for proper stdio handling
        // Resolve full path for common commands (macOS homebrew)
        let command = config.command;
        if (command === 'npx') {
            command = '/opt/homebrew/bin/npx';
        } else if (command === 'node') {
            command = '/opt/homebrew/bin/node';
        }

        console.log(`[MCP ${config.id}] Resolved command: ${command}`);

        // Ensure PATH includes common locations for node/npx
        const currentPath = process.env.PATH || '';
        const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
        const newPath = extraPaths.filter(p => !currentPath.includes(p)).join(':') + (currentPath ? ':' + currentPath : '');

        const enhancedEnv = {
            ...process.env,
            ...config.env,
            PATH: newPath
        };

        // Debug PATH being used
        console.log(`[MCP ${config.id}] Using PATH: ${newPath.substring(0, 200)}...`);

        const proc = spawn(command, config.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,  // Don't use shell - direct execution for proper stdio capture
            cwd: process.cwd(),
            env: enhancedEnv
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
            const str = data.toString();
            // Log first part of stdout to confirm data reception
            if (mcpProcess.buffer.length === 0) {
                console.log(`[MCP ${config.id}] First stdout received:`, str.substring(0, 200));
            }
            this.handleStdout(mcpProcess, str);
        });

        // Handle stderr
        let stderrBuffer = '';
        proc.stderr?.on('data', (data: Buffer) => {
            const str = data.toString();
            stderrBuffer += str;
            console.log(`[MCP ${config.id}] stderr:`, str);
        });

        // Handle process exit
        proc.on('exit', (code, signal) => {
            console.log(`[MCP ${config.id}] Process exited with code ${code}, signal ${signal}`);
            this.processes.delete(config.id);
            // Reject all pending requests
            for (const [id, { reject }] of mcpProcess.pendingRequests) {
                reject(new Error(`Process exited unexpectedly (code: ${code}, signal: ${signal}). Stderr: ${stderrBuffer}`));
            }
            mcpProcess.pendingRequests.clear();
        });

        proc.on('error', (err) => {
            console.error(`[MCP ${config.id}] Process error:`, err);
        });

        this.processes.set(config.id, mcpProcess);

        // Wait for process to spawn before initializing
        await new Promise<void>((resolve, reject) => {
            proc.on('spawn', () => {
                console.log(`[MCP ${config.id}] Process spawned, PID: ${proc.pid}`);
                resolve();
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });

        // Wait for MCP server to be ready (look for ready message or timeout)
        await new Promise<void>((resolve) => {
            let ready = false;
            const readyTimeout = setTimeout(() => {
                if (!ready) {
                    console.log(`[MCP ${config.id}] Ready timeout (30s), proceeding...`);
                    resolve();
                }
            }, 30000); // Wait up to 30 seconds for ready message (npx may need to download package)

            const checkReady = (data: Buffer) => {
                const str = data.toString();
                if (str.includes('running on stdio') || str.includes('MCP') || str.includes('ready') || str.includes('Server')) {
                    ready = true;
                    clearTimeout(readyTimeout);
                    console.log(`[MCP ${config.id}] Server ready message detected`);
                    resolve();
                }
            };

            proc.stderr?.on('data', checkReady);
            proc.stdout?.on('data', checkReady);
        });

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
            }, 60000);

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
            console.log(`[MCP ${mcpProcess.id}] stdin sending:`, message.substring(0, 500));
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
