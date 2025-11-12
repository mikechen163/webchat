// 直接测试会话验证
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function debugSession() {
  try {
    console.log('=== 会话验证调试 ===');
    
    // 模拟hooks.server.ts中的验证过程
    const { auth } = await import('./src/lib/server/auth.js');
    
    // 测试会话ID
    const sessionId = 'qmobdw7a4dzbrfuojcbbrwfep45gtyfhxof3azln';
    
    console.log('1. 测试会话ID:', sessionId);
    console.log('2. Auth对象:', typeof auth);
    console.log('3. SessionCookieName:', auth.sessionCookieName);
    
    // 尝试验证会话
    console.log('4. 开始验证会话...');
    const session = await auth.validateSession(sessionId);
    
    if (session) {
      console.log('✅ 会话验证成功');
      console.log('   用户ID:', session.user.id);
      console.log('   用户邮箱:', session.user.email);
      console.log('   用户角色:', session.user.role);
      console.log('   会话过期:', session.expiresAt);
    } else {
      console.log('❌ 会话验证失败 - 返回null');
    }
    
    // 检查具体的错误
    console.log('5. 检查会话数据库记录...');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const dbSession = await prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    
    if (dbSession) {
      console.log('✅ 数据库中找到会话');
      console.log('   过期时间:', dbSession.expiresAt);
      console.log('   当前时间:', new Date().toISOString());
      console.log('   是否过期:', new Date(dbSession.expiresAt) < new Date());
    } else {
      console.log('❌ 数据库中未找到会话');
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

debugSession();