import puppeteer from 'puppeteer';

async function testBrowserLogin() {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      slowMo: 100
    });
    
    const page = await browser.newPage();
    
    // 监听控制台消息
    page.on('console', msg => console.log('Browser console:', msg.text()));
    
    // 监听网络响应
    page.on('response', response => {
      if (response.url().includes('/auth/login')) {
        console.log(`Login response: ${response.status()} ${response.statusText()}`);
      }
    });
    
    // 导航到登录页面
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForSelector('form');
    
    // 填写表单
    await page.type('input[name="email"]', 'admin@example.com');
    await page.type('input[name="password"]', 'admin123');
    
    // 提交表单
    await Promise.all([
      page.waitForNavigation(),
      page.click('button[type="submit"]')
    ]);
    
    console.log(`最终URL: ${page.url()}`);
    
    // 检查Cookie
    const cookies = await page.cookies();
    console.log('浏览器Cookie:', cookies);
    
    // 尝试访问聊天页面
    await page.goto('http://localhost:3000/chat');
    console.log(`聊天页面URL: ${page.url()}`);
    
  } catch (error) {
    console.error('浏览器测试失败:', error);
  } finally {
    if (browser) await browser.close();
  }
}

testBrowserLogin();