/**
 * 加密工具单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  generateEncryptionKey,
  hashSensitiveData,
  secureCompare,
  maskApiKey,
  validateApiKey
} from '../crypto';

describe('Crypto Utils', () => {
  describe('encryptApiKey / decryptApiKey', () => {
    it('should encrypt and decrypt API key correctly', () => {
      const apiKey = 'sk-test1234567890abcdef';
      
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
      expect(encrypted).not.toBe(apiKey);
      expect(encrypted).toContain(':'); // Should contain IV separator
    });

    it('should handle empty API key', () => {
      const apiKey = '';
      
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    it('should handle long API key', () => {
      const apiKey = 'sk-' + 'a'.repeat(200);
      
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);
      
      expect(decrypted).toBe(apiKey);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decryptApiKey('invalid-format')).toThrow('Invalid encrypted key format');
    });

    it('should throw error for malformed encrypted data', () => {
      expect(() => decryptApiKey('valid-iv:invalid-hex-data')).toThrow();
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate valid encryption key', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
      expect(key2).toMatch(/^[0-9a-f]{64}$/);
      expect(key1).not.toBe(key2); // Should be random
    });
  });

  describe('hashSensitiveData', () => {
    it('should generate consistent hash', () => {
      const data = 'sensitive-data-123';
      
      const hash1 = hashSensitiveData(data);
      const hash2 = hashSensitiveData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/); // SHA256 = 64 hex chars
    });

    it('should generate different hash for different data', () => {
      const data1 = 'data-1';
      const data2 = 'data-2';
      
      const hash1 = hashSensitiveData(data1);
      const hash2 = hashSensitiveData(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashSensitiveData('');
      
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBeTruthy();
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      const str1 = 'test-string-123';
      const str2 = 'test-string-123';
      
      const result = secureCompare(str1, str2);
      
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const str1 = 'test-string-123';
      const str2 = 'test-string-456';
      
      const result = secureCompare(str1, str2);
      
      expect(result).toBe(false);
    });

    it('should return false for different length strings', () => {
      const str1 = 'short';
      const str2 = 'longer-string';
      
      const result = secureCompare(str1, str2);
      
      expect(result).toBe(false);
    });

    it('should handle empty strings', () => {
      const result1 = secureCompare('', '');
      const result2 = secureCompare('', 'non-empty');
      
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle special characters', () => {
      const str1 = 'test@#$%^&*()';
      const str2 = 'test@#$%^&*()';
      
      const result = secureCompare(str1, str2);
      
      expect(result).toBe(true);
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key correctly', () => {
      const apiKey = 'sk-test1234567890abcdef';
      
      const masked = maskApiKey(apiKey);
      
      expect(masked).toBe('sk-t**************************cdef');
    });

    it('should handle short API keys', () => {
      const apiKey = 'sk-short';
      
      const masked = maskApiKey(apiKey);
      
      expect(masked).toBe('sk-s****rt');
    });

    it('should handle very short API keys', () => {
      const apiKey = 'sk-12';
      
      const masked = maskApiKey(apiKey);
      
      expect(masked).toBe('***');
    });

    it('should handle empty API key', () => {
      const apiKey = '';
      
      const masked = maskApiKey(apiKey);
      
      expect(masked).toBe('***');
    });

    it('should handle API key with special characters', () => {
      const apiKey = 'sk-test@#$%^&*()12345678';
      
      const masked = maskApiKey(apiKey);
      
      expect(masked).toContain('sk-t');
      expect(masked).toContain('5678');
      expect(masked).toContain('****');
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key', () => {
      const apiKey = 'sk-test1234567890abcdef';
      
      const result = validateApiKey(apiKey);
      
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject too short API key', () => {
      const apiKey = 'sk-short';
      
      const result = validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key is too short');
    });

    it('should reject too long API key', () => {
      const apiKey = 'sk-' + 'a'.repeat(600);
      
      const result = validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key is too long');
    });

    it('should reject API key with HTML injection characters', () => {
      const apiKey = 'sk-test<script>alert(1)</script>';
      
      const result = validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key contains invalid characters');
    });

    it('should reject API key with template injection', () => {
      const apiKey = 'sk-test${process.env.SECRET}';
      
      const result = validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key contains invalid characters');
    });

    it('should reject API key with command injection', () => {
      const apiKey = 'sk-test`whoami`';
      
      const result = validateApiKey(apiKey);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key contains invalid characters');
    });

    it('should reject null API key', () => {
      const result = validateApiKey(null as any);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key is required');
    });

    it('should reject undefined API key', () => {
      const result = validateApiKey(undefined as any);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key is required');
    });

    it('should reject non-string API key', () => {
      const result = validateApiKey(12345 as any);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key is required');
    });
  });
});