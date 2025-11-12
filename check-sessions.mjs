import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSessions() {
  try {
    console.log('=== 检查数据库会话 ===');
    
    // 检查所有会话
    const sessions = await prisma.authSession.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`找到 ${sessions.length} 个会话:`);
    const now = new Date();
    
    sessions.forEach((session, index) => {
      const isExpired = new Date(session.expiresAt) < now;
      console.log(`\n${index + 1}. 会话ID: ${session.id}`);
      console.log(`   用户ID: ${session.userId}`);
      console.log(`   用户邮箱: ${session.user?.email || '未知'}`);
      console.log(`   创建时间: ${session.createdAt}`);
      console.log(`   过期时间: ${session.expiresAt}`);
      console.log(`   是否过期: ${isExpired ? '是' : '否'}`);
      console.log(`   当前时间: ${now.toISOString()}`);
    });
    
    // 检查用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        language: true,
        theme: true
      }
    });
    
    console.log(`\n=== 用户列表 ===`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSessions();