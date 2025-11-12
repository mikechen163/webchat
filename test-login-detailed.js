import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

async function testLoginDetailed() {
  let browser;
  try {
    console.log('=== 详细登录测试开始 ===');
    
    // 首先查看服务器日志
    console.log('\n1. 检查服务器状态...');
    try {
      const result = execSync('ps aux | grep -E "(node|vite)" | grep -v grep', { encoding: 'utf8' });
      console.log('✓ 服务器进程存在:', result.trim().split('\n').length, '个进程');
    } catch (e) {
      console.log('⚠️  未找到服务器进程');
    }

    browser = await puppeteer.launch({ 
      headless: false, // 可见浏览器以便观察
      slowMo: 50,      // 减慢操作便于观察
      devtools: true,  // 打开开发者工具
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 启用所有控制台消息
    page.on('console', msg => {
      console.log('🌐 浏览器控制台:', msg.text());
    });
    
    // 监听网络请求
    page.on('request', request => {
      if (request.url().includes('/auth/') || request.url().includes('/chat')) {
        console.log('📤 请求:', request.method(), request.url());
      }
    });
    
    // 监听网络响应
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/auth/') || url.includes('/chat')) {
        console.log('📥 响应:', response.status(), response.statusText(), url);
        
        // 检查响应头中的Set-Cookie
        const headers = response.headers();
        if (headers['set-cookie']) {
          console.log('🍪 Set-Cookie头:', headers['set-cookie']);
        }
      }
    });
    
    // 监听重定向
    page.on('requestfinished', request => {
      if (request.redirectChain().length > 0) {
        console.log('🔄 重定向链:', request.redirectChain().map(r => r.url()));
      }
    });
    
    console.log('\n2. 导航到登录页面...');
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForSelector('form', { timeout: 5000 });
    
    console.log('✓ 登录页面加载成功');
    console.log('📸 当前页面截图: login-page.png');
    await page.screenshot({ path: 'login-page.png' });
    
    console.log('\n3. 获取当前Cookie...');
    const initialCookies = await page.cookies();
    console.log('初始Cookie数量:', initialCookies.length);
    initialCookies.forEach(cookie => {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
    });
    
    console.log('\n4. 填写登录表单...');
    await page.type('input[name="email"]', 'admin@example.com', { delay: 100 });
    await page.type('input[name="password"]', 'admin123', { delay: 100 });
    
    console.log('\n5. 提交表单...');
    
    // 等待导航完成
    const navigationPromise = page.waitForNavigation({ 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    await page.click('button[type="submit"]');
    await navigationPromise;
    
    console.log('✓ 表单提交完成');
    console.log('📍 当前URL:', page.url());
    
    console.log('\n6. 检查登录后的Cookie...');
    const finalCookies = await page.cookies();
    console.log('最终Cookie数量:', finalCookies.length);
    finalCookies.forEach(cookie => {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      console.log(`    Domain: ${cookie.domain}, Path: ${cookie.path}, Secure: ${cookie.secure}, SameSite: ${cookie.sameSite}`);
    });
    
    console.log('\n7. 尝试访问聊天页面...');
    await page.goto('http://localhost:3000/chat');
    await page.waitForTimeout(2000); // 等待重定向
    
    console.log('📍 最终URL:', page.url());
    
    if (page.url().includes('/auth/login')) {
      console.log('❌ 被重定向回登录页面');
    } else if (page.url().includes('/chat')) {
      console.log('✅ 成功访问聊天页面');
    }
    
    console.log('\n8. 检查页面内容...');
    const pageContent = await page.content();
    if (pageContent.includes('Redirecting to login')) {
      console.log('❌ 页面包含重定向到登录的提示');
    }
    if (pageContent.includes('No authenticated user')) {
      console.log('❌ 页面包含未认证用户提示');
    }
    
    console.log('\n📸 最终页面截图: final-page.png');
    await page.screenshot({ path: 'final-page.png' });
    
    // 检查本地存储
    console.log('\n9. 检查本地存储...');
    const localStorage = await page.evaluate(() => {
      return Object.fromEntries(Object.entries(localStorage));
    });
    console.log('本地存储:', localStorage);
    
    // 检查会话存储
    const sessionStorage = await page.evaluate(() => {
      return Object.fromEntries(Object.entries(sessionStorage));
    });
    console.log('会话存储:', sessionStorage);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (browser) {
      console.log('\n=== 关闭浏览器 ===');
      await browser.close();
    }
  }
}

testLoginDetailed();