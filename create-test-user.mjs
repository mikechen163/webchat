#!/usr/bin/env node

/**
 * 创建测试用户的脚本
 * 运行: node create-test-user.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // 检查是否已存在测试用户
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });

    if (existingUser) {
      console.log('测试用户已存在:', existingUser.email);
      console.log('登录信息:');
      console.log('邮箱: admin@example.com');
      console.log('密码: admin123');
      return;
    }

    // 创建测试管理员用户
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        name: '管理员',
        role: 'admin',
        language: 'zh',
        theme: 'system'
      }
    });

    console.log('测试用户创建成功!');
    console.log('登录信息:');
    console.log('邮箱: admin@example.com');
    console.log('密码: admin123');
    console.log('角色: 管理员');
    
  } catch (error) {
    console.error('创建用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
createTestUser();