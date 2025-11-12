import { PrismaClient } from '@prisma/client';
import { auth } from './src/lib/server/auth.js';

const prisma = new PrismaClient();

async function testSessionValidation() {
  try {
    // 从curl测试中获取的session ID
    const sessionId = 'qmobdw7a4dzbrfuojcbbrwfep45gtyfhxof3azln';
    
    console.log('=== 会话验证测试 ===');
    console.log('测试的Session ID:', sessionId);
    
    // 1. 检查数据库中的会话
    const dbSession = await prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    
    if (dbSession) {
      console.log('✓ 数据库中找到会话');
      console.log('  用户ID:', dbSession.userId);
      console.log('  过期时间:', dbSession.expiresAt);
      console.log('  当前时间:', new Date().toISOString());
      console.log('  是否过期:', new Date(dbSession.expiresAt) < new Date());
      if (dbSession.user) {
        console.log('  用户邮箱:', dbSession.user.email);
      }
    } else {
      console.log('❌ 数据库中未找到会话');
    }
    
    // 2. 使用auth.validateSession验证
    console.log('\n--- 使用auth.validateSession验证 ---');
    const validatedSession = await auth.validateSession(sessionId);
    
    if (validatedSession) {
      console.log('✓ 会话验证成功');
      console.log('  用户邮箱:', validatedSession.user.email);
      console.log('  用户角色:', validatedSession.user.role);
    } else {
      console.log('❌ 会话验证失败');
    }
    
    // 3. 检查所有活动会话
    console.log('\n--- 所有活动会话 ---');
    const allSessions = await prisma.authSession.findMany({
      include: { user: true },
      take: 5
    });
    
    console.log(`找到 ${allSessions.length} 个会话:`);
    allSessions.forEach((session, index) => {
      console.log(`  ${index + 1}. ID: ${session.id.substring(0, 20)}...`);
      console.log(`     用户: ${session.user?.email || '未知'}`);
      console.log(`     过期: ${session.expiresAt}`);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSessionValidation();