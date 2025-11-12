#!/usr/bin/env node

/**
 * 测试登录功能的脚本
 * 运行: node test-login.mjs
 */

import { auth } from './src/lib/server/auth.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function testAuth() {
  try {
    console.log('=== 测试认证系统 ===');
    
    // 1. 检查测试用户是否存在
    const user = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    if (!user) {
      console.log('❌ 测试用户不存在');
      return;
    }
    
    console.log('✅ 测试用户存在:', user.email);
    console.log('✅ 用户角色:', user.role);
    
    // 2. 测试密码验证
    const validPassword = await bcrypt.compare('admin123', user.passwordHash);
    if (validPassword) {
      console.log('✅ 密码验证成功');
    } else {
      console.log('❌ 密码验证失败');
    }
    
    // 3. 测试会话创建
    try {
      const session = await auth.createSession(user.id, {});
      console.log('✅ 会话创建成功:', session.id);
      
      // 4. 测试会话验证
      const validatedSession = await auth.validateSession(session.id);
      if (validatedSession) {
        console.log('✅ 会话验证成功');
        console.log('✅ 会话用户:', validatedSession.user.email);
      } else {
        console.log('❌ 会话验证失败');
      }
      
      // 清理测试会话
      await auth.invalidateSession(session.id);
      console.log('✅ 测试会话已清理');
      
    } catch (sessionError) {
      console.log('❌ 会话创建失败:', sessionError.message);
    }
    
    console.log('\n=== 认证系统测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();