/**
 * Stdio传输实现
 * 通过标准输入输出与MCP服务器进程通信
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { MCP_ERROR_CODES } from '../types';
import { McpServerError, createMcpError } from '../errors';
import type { McpServerConfig, McpTransport, McpMessage } from '../types';

/**
 * Stdio传输类
 * 管理MCP服务器进程的生命周期和通信
 */
export class StdioTransport extends EventEmitter implements McpTransport {
  private process?: any;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isInitialized = false;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  
  constructor(private config: McpServerConfig) {
    super();
    
    if (config.transport !== 'stdio') {
      throw new McpServerError(
        'StdioTransport requires stdio transport type',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
  }
  
  /**
   * 初始化传输，启动子进程
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (!this.config.command) {
      throw new McpServerError(
        'Command is required for stdio transport',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    try {
      // 安全验证命令
      this.validateCommand(this.config.command);
      
      // 解析命令和参数
      const [command, ...args] = this.config.command.split(' ');
      
      // 启动子进程
      this.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
        shell: false, // 禁用shell注入
        env: {
          ...process.env,
          MCP_API_KEY: this.config.apiKey || '',
          MCP_SERVER_NAME: this.config.name,
          MCP_TRANSPORT: 'stdio'
        }
      });
      
      this.setupProcessHandlers();
      
      // 等待进程启动
      await this.waitForProcessStart();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.cleanup();
      throw createMcpError(error, 'Failed to initialize stdio transport');
    }
  }
  
  /**
   * 发送消息到MCP服务器
   */
  async sendMessage(message: any): Promise<any> {
    if (!this.isInitialized || !this.process) {
      throw new McpServerError(
        'Stdio transport not initialized',
        MCP_ERROR_CODES.TRANSPORT_ERROR,
        500
      );
    }
    
    if (!this.process.stdin) {
      throw new McpServerError(
        'Process stdin not available',
        MCP_ERROR_CODES.TRANSPORT_ERROR,
        500
      );
    }
    
    const messageId = ++this.messageId;
    const request = {
      id: messageId,
      ...message
    };
    
    return new Promise((resolve, reject) => {
      try {
        // 设置超时
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(messageId);
          reject(new McpServerError(
            'MCP server response timeout',
            MCP_ERROR_CODES.TIMEOUT,
            408
          ));
        }, 30000); // 30秒超时
        
        // 存储待处理请求
        this.pendingRequests.set(messageId, {
          resolve,
          reject,
          timeout
        });
        
        // 发送请求到stdin
        const requestData = JSON.stringify(request) + '\n';
        this.process!.stdin!.write(requestData, (error) => {
          if (error) {
            this.pendingRequests.delete(messageId);
            clearTimeout(timeout);
            reject(createMcpError(error, 'Failed to send message to MCP server'));
          }
        });
        
      } catch (error) {
        this.pendingRequests.delete(messageId);
        reject(createMcpError(error, 'Failed to send message'));
      }
    });
  }
  
  /**
   * 清理资源，终止进程
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    
    // 清理所有待处理请求
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new McpServerError(
        'Transport cleanup - request cancelled',
        MCP_ERROR_CODES.TRANSPORT_ERROR,
        500
      ));
    }
    this.pendingRequests.clear();
    
    // 终止进程
    if (this.process) {
      try {
        // 尝试优雅关闭
        this.process.stdin?.end();
        
        // 等待进程退出或强制终止
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGTERM');
          }
        }, 5000);
        
        this.process.on('exit', () => {
          clearTimeout(timeout);
        });
        
      } catch (error) {
        console.error('Error during process cleanup:', error);
      } finally {
        this.process = undefined;
      }
    }
    
    this.emit('cleanup');
  }
  
  /**
   * 检查传输是否健康
   */
  isHealthy(): boolean {
    if (!this.isInitialized || !this.process) {
      return false;
    }
    
    return !this.process.killed && this.process.exitCode === null;
  }
  
  /**
   * 设置进程事件处理器
   */
  private setupProcessHandlers(): void {
    if (!this.process) {
      return;
    }
    
    // stdout数据处理
    this.process.stdout?.on('data', (data: Buffer) => {
      try {
        this.stdoutBuffer += data.toString();
        this.processStdoutBuffer();
      } catch (error) {
        console.error('Error processing stdout data:', error);
      }
    });
    
    // stderr数据处理
    this.process.stderr?.on('data', (data: Buffer) => {
      try {
        this.stderrBuffer += data.toString();
        console.warn('MCP server stderr:', data.toString());
      } catch (error) {
        console.error('Error processing stderr data:', error);
      }
    });
    
    // 进程退出处理
    this.process.on('exit', (code, signal) => {
      console.log(`MCP server process exited with code ${code} and signal ${signal}`);
      
      // 拒绝所有待处理请求
      for (const [id, request] of this.pendingRequests) {
        clearTimeout(request.timeout);
        request.reject(new McpServerError(
          `MCP server process exited (code: ${code}, signal: ${signal})`,
          MCP_ERROR_CODES.SERVER_UNAVAILABLE,
          503
        ));
      }
      this.pendingRequests.clear();
      
      this.emit('exit', { code, signal });
    });
    
    // 进程错误处理
    this.process.on('error', (error) => {
      console.error('MCP server process error:', error);
      this.emit('error', error);
    });
  }
  
  /**
   * 处理stdout缓冲区
   */
  private processStdoutBuffer(): void {
    const lines = this.stdoutBuffer.split('\n');
    
    // 保留最后一行（可能不完整）
    this.stdoutBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        this.processResponseLine(line.trim());
      }
    }
  }
  
  /**
   * 处理响应行
   */
  private processResponseLine(line: string): void {
    try {
      const response = JSON.parse(line);
      
      if (response.id && this.pendingRequests.has(response.id)) {
        const request = this.pendingRequests.get(response.id)!;
        this.pendingRequests.delete(response.id);
        clearTimeout(request.timeout);
        
        if (response.error) {
          request.reject(new McpServerError(
            response.error.message || 'MCP server error',
            response.error.code || MCP_ERROR_CODES.TRANSPORT_ERROR,
            response.error.statusCode || 500
          ));
        } else {
          request.resolve(response);
        }
      }
    } catch (error) {
      // 忽略非JSON行（可能是日志输出）
      console.debug('Non-JSON output from MCP server:', line);
    }
  }
  
  /**
   * 等待进程启动
   */
  private async waitForProcessStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new McpServerError(
          'MCP server process startup timeout',
          MCP_ERROR_CODES.TIMEOUT,
          408
        ));
      }, 10000); // 10秒启动超时
      
      const onStart = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      const onError = (error: any) => {
        clearTimeout(timeout);
        reject(createMcpError(error, 'MCP server process failed to start'));
      };
      
      // 监听进程启动事件
      this.process!.on('spawn', onStart);
      this.process!.on('error', onError);
      
      // 清理监听器
      setTimeout(() => {
        this.process!.off('spawn', onStart);
        this.process!.off('error', onError);
      }, 10000);
    });
  }
  
  /**
   * 验证命令安全性
   */
  private validateCommand(command: string): void {
    if (!command || command.trim().length === 0) {
      throw new McpServerError(
        'Command cannot be empty',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
    
    // 基本安全检查 - 检查明显的危险字符
    const dangerousChars = ['&', '|', ';', '`', '$', '<', '>'];
    for (const char of dangerousChars) {
      if (command.includes(char)) {
        throw new McpServerError(
          `Command contains potentially dangerous character: ${char}`,
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
    }
    
    // 检查危险命令
    const dangerousCommands = ['rm', 'del', 'format', 'sudo', 'su'];
    for (const cmd of dangerousCommands) {
      if (command.toLowerCase().startsWith(cmd + ' ')) {
        throw new McpServerError(
          `Command contains dangerous executable: ${cmd}`,
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
    }
    
    // 只允许安全的可执行文件路径
    const allowedPaths = [
      '/usr/local/bin/',
      '/usr/bin/',
      '/bin/',
      './server/',                // 项目内的server目录
      'python', 'python3',        // 基本命令
      'node', 'npm', 'npx'        // Node.js相关
    ];
    
    const commandParts = command.split(' ');
    const executable = commandParts[0];
    
    // 如果包含路径，验证路径安全性
    if (executable.includes('/')) {
      const isAllowed = allowedPaths.some(path => 
        executable.startsWith(path) || 
        executable.startsWith('./') ||
        executable.startsWith('../server/')  // 允许相对路径到server目录
      );
      
      if (!isAllowed) {
        throw new McpServerError(
          `Command executable path not allowed: ${executable}`,
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
    }
    
    // 命令长度限制
    if (command.length > 500) {
      throw new McpServerError(
        'Command too long (max 500 characters)',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
  }
}

/**
 * Stdio传输工厂函数
 */
export function createStdioTransport(config: McpServerConfig): StdioTransport {
  return new StdioTransport(config);
}