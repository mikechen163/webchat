// 调试会话数据问题
import { PrismaClient } from '@prisma/client';
import { auth } from './src/lib/server/auth.js';

const prisma = new PrismaClient();

async function debugSessionData() {
  try {
    console.log('=== 会话数据调试 ===');
    
    // 获取最新的会话ID（从日志中看到的）
    const sessions = await prisma.authSession.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log('数据库中的会话:');
    sessions.forEach((session, index) => {
      console.log(`\n${index + 1}. 会话ID: ${session.id}`);
      console.log(`   用户ID: ${session.userId}`);
      console.log(`   过期时间: ${session.expiresAt}`);
      console.log(`   用户数据:`, session.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role
      } : '无用户数据');
    });
    
    if (sessions.length > 0) {
      const latestSession = sessions[0];
      console.log('\n--- 验证最新会话 ---');
      console.log('验证会话ID:', latestSession.id);
      
      const validatedSession = await auth.validateSession(latestSession.id);
      
      if (validatedSession) {
        console.log('✅ 会话验证成功');
        console.log('会话对象:', {
          id: validatedSession.id,
          expiresAt: validatedSession.expiresAt,
          hasUser: !!validatedSession.user,
          userId: validatedSession.user?.id,
          userEmail: validatedSession.user?.email
        });
        
        if (validatedSession.user) {
          console.log('用户详情:', validatedSession.user);
        } else {
          console.log('❌ 会话中没有用户数据');
        }
      } else {
        console.log('❌ 会话验证失败');
      }
    }
    
    // 检查用户属性映射
    console.log('\n--- 检查用户属性映射 ---');
    const testUser = await prisma.user.findFirst();
    if (testUser) {
      console.log('数据库用户数据:', {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        language: testUser.language,
        theme: testUser.theme
      });
      
      console.log('\nAuth配置的用户属性映射:');
      console.log('getUserAttributes 函数应该映射这些字段');
    }
    
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSessionData();