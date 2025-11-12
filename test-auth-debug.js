import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function testAuth() {
  try {
    // 检查是否有用户存在
    const userCount = await prisma.user.count();
    console.log(`数据库中的用户数量: ${userCount}`);
    
    if (userCount === 0) {
      console.log('数据库中没有用户，需要创建测试用户');
      return;
    }
    
    // 获取第一个用户
    const firstUser = await prisma.user.findFirst();
    console.log(`第一个用户: ${firstUser.email}, 角色: ${firstUser.role}`);
    
    // 检查会话表
    const sessionCount = await prisma.authSession.count();
    console.log(`活动会话数量: ${sessionCount}`);
    
    // 检查用户属性
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
    
    console.log('用户详情:', JSON.stringify(users, null, 2));
    
  } catch (error) {
    console.error('数据库查询错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();