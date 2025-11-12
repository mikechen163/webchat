import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { auth } from './src/lib/server/auth.js';

const prisma = new PrismaClient();

async function testLoginFlow() {
  try {
    console.log('=== 测试登录流程 ===');
    
    // 1. 检查用户
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ 没有找到用户');
      return;
    }
    
    console.log(`✓ 找到用户: ${user.email}`);
    
    // 2. 验证密码 (假设密码是 "admin123")
    const testPassword = 'admin123';
    const isValidPassword = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`✓ 密码验证: ${isValidPassword ? '通过' : '失败'}`);
    
    if (!isValidPassword) {
      console.log('❌ 密码验证失败');
      return;
    }
    
    // 3. 创建会话
    console.log('✓ 创建会话...');
    const session = await auth.createSession(user.id, {});
    console.log(`✓ 会话创建成功: ${session.id}`);
    console.log(`✓ 会话过期时间: ${session.expiresAt}`);
    console.log(`✓ 会话用户: ${session.user?.email || '无用户数据'}`);
    
    // 4. 验证会话
    console.log('✓ 验证会话...');
    const validatedSession = await auth.validateSession(session.id);
    console.log(`✓ 会话验证结果: ${validatedSession ? '有效' : '无效'}`);
    
    if (validatedSession) {
      console.log(`✓ 验证通过，用户: ${validatedSession.user.email}`);
    }
    
    // 5. 检查Cookie设置
    const sessionCookie = auth.createSessionCookie(session.id);
    console.log(`✓ Cookie名称: ${sessionCookie.name}`);
    console.log(`✓ Cookie值长度: ${sessionCookie.value.length}`);
    console.log(`✓ Cookie属性:`, sessionCookie.attributes);
    
    // 6. 创建空白会话Cookie
    const blankCookie = auth.createBlankSessionCookie();
    console.log(`✓ 空白Cookie名称: ${blankCookie.name}`);
    console.log(`✓ 空白Cookie值: ${blankCookie.value}`);
    
    console.log('\n=== 登录流程测试完成 ===');
    
  } catch (error) {
    console.error('❌ 登录流程测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testLoginFlow();