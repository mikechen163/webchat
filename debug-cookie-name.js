// 调试Cookie名称
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function debugCookieName() {
  try {
    console.log('=== Cookie名称调试 ===');
    
    const { auth } = await import('./src/lib/server/auth.js');
    
    console.log('1. Auth对象:', typeof auth);
    console.log('2. SessionCookieName:', auth.sessionCookieName);
    console.log('3. 所有属性:', Object.getOwnPropertyNames(auth));
    
    // 检查Cookie名称的历史记录
    console.log('\n=== 历史Cookie名称 ===');
    console.log('当前Cookie名称:', auth.sessionCookieName);
    
    // 检查Prisma适配器
    console.log('\n=== Prisma适配器检查 ===');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // 检查表结构
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%session%'`;
    console.log('会话相关表:', tables);
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

debugCookieName();