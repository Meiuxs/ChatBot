import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:5174';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // 注入 localStorage auth 状态（模拟用户已登录）
  await context.addInitScript(() => {
    localStorage.setItem('chatbot_is_logged_in', 'true');
    localStorage.setItem('chatbot_user', JSON.stringify({ email: 'admin@admin.com' }));
  });

  const page = await context.newPage();

  // 收集所有 console 日志
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // 收集网络请求
  const networkRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      networkRequests.push({ url: req.url(), method: req.method(), status: 'pending' });
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/')) {
      const entry = networkRequests.find(r => r.url === res.url() && r.status === 'pending');
      if (entry) {
        entry.status = res.status();
      }
    }
  });

  // 1. 打开聊天页面
  console.log('=== 导航到 /chat ===');
  await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 截图1：页面初始状态
  await page.screenshot({ path: 'debug-01-chat-page.png', fullPage: false });
  console.log('截图1 已保存: debug-01-chat-page.png');

  // 2. 检查当前 URL（是否被重定向到 /login？）
  const currentUrl = page.url();
  console.log(`当前 URL: ${currentUrl}`);

  if (currentUrl.includes('/login')) {
    console.log('!!! 被重定向到登录页，需要先处理认证 !!!');

    // 尝试另一种登录方式：先导航到 /login 然后设置 localStorage
    await page.evaluate(() => {
      localStorage.setItem('chatbot_is_logged_in', 'true');
      localStorage.setItem('chatbot_user', JSON.stringify({ email: 'admin@admin.com' }));
    });
    await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const retryUrl = page.url();
    console.log(`重试后 URL: ${retryUrl}`);
    await page.screenshot({ path: 'debug-02-after-auth.png', fullPage: false });
  }

  // 3. 检查页面上的元素
  const hasChatInput = await page.$('textarea');
  const hasSendButton = await page.$('.btn-send');
  console.log(`有输入框: ${!!hasChatInput}, 有发送按钮: ${!!hasSendButton}`);

  // 4. 查找并检查会话列表和消息区域
  const pageContent = await page.textContent('body');
  console.log(`页面文本摘要: ${pageContent.substring(0, 300)}...`);

  // 5. 输入消息并发送
  if (hasChatInput) {
    await page.fill('textarea', '你好');
    await page.waitForTimeout(500);

    // 截图2：输入内容后
    await page.screenshot({ path: 'debug-03-before-send.png', fullPage: false });

    // 点击发送按钮
    const sendBtn = await page.$('.btn-send');
    if (sendBtn) {
      // 设置网络请求监听，捕获 stream 响应
      const streamResponsePromise = new Promise((resolve) => {
        page.on('response', async (res) => {
          if (res.url().includes('/api/chat/stream')) {
            let body = '';
            try {
              body = await res.text();
            } catch (e) {
              body = `[读取失败: ${e.message}]`;
            }
            resolve({ status: res.status(), headers: res.headers(), body: body.substring(0, 500) });
          }
        });
        // 超时处理
        setTimeout(() => resolve({ status: 'timeout', body: '等待响应超时' }), 10000);
      });

      await sendBtn.click();

      // 等待网络响应
      const streamResult = await streamResponsePromise;
      console.log('\n=== /api/chat/stream 响应 ===');
      console.log(JSON.stringify(streamResult, null, 2));

      // 等待页面更新
      await page.waitForTimeout(2000);

      // 截图3：发送后
      await page.screenshot({ path: 'debug-04-after-send.png', fullPage: false });

      // 检查消息列表中是否有新内容
      const messages = await page.$$('.message');
      console.log(`\n消息数量: ${messages.length}`);
    } else {
      console.log('!!! 未找到发送按钮');
    }
  }

  // 6. 输出所有网络请求记录
  console.log('\n=== 网络请求记录 ===');
  for (const req of networkRequests) {
    console.log(`${req.method} ${req.url} → ${req.status}`);
  }

  // 7. 输出 console 日志
  console.log('\n=== Console 日志 ===');
  for (const log of consoleLogs) {
    console.log(log);
  }

  await browser.close();
  console.log('\n=== 调试完成 ===');
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
