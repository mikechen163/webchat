/**
 * 加密工具类
 * 用于安全存储API密钥等敏感信息
 */

import crypto from 'crypto';

// 从环境变量获取加密密钥，如果没有则生成一个
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32);

const IV_LENGTH = 16; // AES块大小

/**
 * 加密API密钥
 */
export function encryptApiKey(apiKey: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // 返回IV和加密数据的组合，用冒号分隔
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    throw new Error(`Failed to encrypt API key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解密API密钥
 */
export function decryptApiKey(encryptedKey: string): string {
  try {
    const parts = encryptedKey.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted key format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Failed to decrypt API key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成安全的随机密钥
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 哈希敏感数据（用于验证，不可逆）
 */
export function hashSensitiveData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .update(ENCRYPTION_KEY) // 添加密钥作为盐值
    .digest('hex');
}

/**
 * 安全比较两个字符串（防止时序攻击）
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');
    
    // 确保长度相同
    if (bufferA.length !== bufferB.length) {
      return false;
    }
    
    // 使用crypto.timingSafeEqual进行安全比较
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

/**
 * 掩码API密钥（用于日志和显示）
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '***';
  }
  
  const prefix = apiKey.slice(0, 4);
  const suffix = apiKey.slice(-4);
  const masked = '*'.repeat(Math.max(3, apiKey.length - 8));
  
  return `${prefix}${masked}${suffix}`;
}

/**
 * 验证API密钥格式
 */
export function validateApiKey(apiKey: string): { valid: boolean; message?: string } {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, message: 'API key is required' };
  }
  
  if (apiKey.length < 10) {
    return { valid: false, message: 'API key is too short' };
  }
  
  if (apiKey.length > 512) {
    return { valid: false, message: 'API key is too long' };
  }
  
  // 检查是否包含可疑字符
  const suspiciousPatterns = [
    /[<>\"'&]/, // HTML注入字符
    /`.*`/,     // 命令注入
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(apiKey)) {
      return { valid: false, message: 'API key contains invalid characters' };
    }
  }
  
  return { valid: true };
}