import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSession() {
  try {
    // 检查会话表结构
    const sessions = await prisma.authSession.findMany({
      include: {
        user: true
      }
    });
    
    console.log('会话详情:');
    sessions.forEach(session => {
      console.log(`
会话ID: ${session.id}
用户ID: ${session.userId}
过期时间: ${session.expiresAt}
用户邮箱: ${session.user?.email}
      `);
    });
    
    if (sessions.length === 0) {
      console.log('没有活动会话');
    }
    
    // 检查数据库时间
    const now = new Date();
    console.log(`\n当前时间: ${now.toISOString()}`);
    
  } catch (error) {
    console.error('会话查询错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSession();