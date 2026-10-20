import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
await mkdir('docs/v2/evidence',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto(process.env.PRISM_TEST_URL??'http://127.0.0.1:1427');
 for(const width of [1440,900,600,440]) {
  await page.setViewportSize({width,height:800});
  const nav=page.getByRole('navigation',{name:'主导航'});
  for(const label of ['仪表盘','监控任务','商品管理','历史记录','通知中心','自动结账','系统设置']) {
   const text=nav.getByRole('button',{name:label,exact:true}).locator('span');
   assert.equal(await text.isVisible(),true,`${width}px 下应显示中文导航：${label}`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${width}px 不得横向溢出`);
 }
 await page.setViewportSize({width:900,height:800});
 await page.screenshot({path:'docs/v2/evidence/sidebar-labels-900.png',fullPage:true});
 console.log('PASS: 1440/900/600/440px 全部7项中文导航可见且无横向溢出');
} finally { await browser.close(); }
