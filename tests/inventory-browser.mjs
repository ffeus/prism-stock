import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const evidence=process.env.PRISM_EVIDENCE_DIR??'docs/v2/evidence';
await mkdir(evidence,{recursive:true});
const url=process.env.PRISM_TEST_URL??'http://127.0.0.1:1425';
const browser=await chromium.launch({headless:true});
const errors=[];let page;
try{
 page=await browser.newPage({viewport:{width:1000,height:800}});page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url);
 await page.getByRole('heading',{name:'仪表盘',level:1}).waitFor();
 assert.equal(await page.evaluate(()=>!!window.__PRISM_TEST__),false);
 assert.match(await page.locator('.live-inventory-banner').innerText(),/实时库存查询/);
 const rpc=(command,args={})=>page.evaluate(async({command,args})=>{const response=await fetch('/__prism/invoke',{method:'POST',headers:{'Content-Type':'application/json','X-Prism-Token':window.__PRISM_RUNTIME__.token},body:JSON.stringify({command,args})});return {status:response.status,body:await response.json()};},{command,args});
 let result=await rpc('get_settings');assert.equal(result.status,200);assert.equal(result.body.result.checkout.enabled,false);assert.equal(result.body.result.checkout.placeOrder,false);assert.equal(result.body.result.intervalSeconds>=60,true);
 assert.equal((await rpc('test_checkout')).status,403);assert.equal((await rpc('test_notify')).status,403);
 const forbidden=structuredClone(result.body.result);forbidden.checkout.placeOrder=true;
 assert.equal((await rpc('save_settings',{settings:forbidden})).status,400);
 const csrf=await page.request.post(url+'/__prism/invoke',{data:{command:'start_watching'},headers:{Origin:'https://evil.example'}});assert.equal(csrf.status(),403);
 for(const name of ['仪表盘','监控任务','商品管理','历史记录','通知中心','自动结账','系统设置'])assert.equal(await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).locator('span').isVisible(),true);
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'自动结账',exact:true}).click();await page.getByText('下单、付款、购物袋、登录及取货人信息均未接通',{exact:false}).waitFor();assert.equal(await page.getByRole('switch').count(),0);
 if(process.env.PRISM_ALLOW_LIVE!=='1') {
   await page.screenshot({path:path.join(evidence,'inventory-browser-connected.png'),fullPage:true});
   console.log('PASS: 浏览器连接真实 Rust、只读保护、同源保护和中文导航；未发起 Apple 查询');
 } else {
   // Explicit opt-in: exactly one SKU x one store, one cycle, never automatically retry.
   assert.equal((await rpc('is_running')).body.result,false,'验收前不得已有查询在运行');
   const products=(await rpc('list_products',{locale:'zh_CN'})).body.result;
   const stores=(await rpc('list_stores',{locale:'zh_CN'})).body.result;
   const product=products.find(product=>product.partNumber===(process.env.PRISM_LIVE_PART??'MYF03CH/A'));
   const store=stores.find(store=>store.number===(process.env.PRISM_LIVE_STORE??'R683'));
   assert.ok(product&&store,'明确指定的验收 SKU 和门店必须存在；不静默替换目标');
   const target={locale:'zh_CN',partNumber:product.partNumber,productName:product.title,storeNumber:store.number,storeTitle:store.title};
   const existing=result.body.result.targets; const before=(await rpc('get_snapshot')).body.result;
   assert.ok(existing.length===0 || (existing.length===1 && existing[0].partNumber===target.partNumber && existing[0].storeNumber===target.storeNumber && before[0].lastCheckedMs===null),'不覆盖已有任务，不重复执行已完成的联网验收');
   assert.equal((await rpc('set_targets',{targets:[target]})).status,200);
   await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'监控任务',exact:true}).click();await page.locator('.task-table-row').waitFor();
   await page.evaluate(()=>{window.__LIVE_CYCLES__=[];});
   // Capture real HTTP stream via a second authorized reader without issuing a query.
   await page.evaluate(()=>{window.__LIVE_EVENT_ABORT__=new AbortController();void(async()=>{const response=await fetch('/__prism/events',{headers:{'X-Prism-Token':window.__PRISM_RUNTIME__.token},signal:window.__LIVE_EVENT_ABORT__.signal});window.__LIVE_EVENT_READY__=true;const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();let buffer='';while(true){const {done,value}=await reader.read();if(done)break;buffer+=value;let end;while((end=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of part.split('\n'))if(line.startsWith('data: ')){const event=JSON.parse(line.slice(6));if(event.payload?.type==='cycleComplete')window.__LIVE_CYCLES__.push(event.payload);}}}})().catch(()=>{});});
   await page.waitForFunction(()=>window.__LIVE_EVENT_READY__===true);
   const startedAt=new Date().toISOString();await page.getByRole('button',{name:'查询一次',exact:true}).click();
   await page.waitForFunction(()=>window.__LIVE_CYCLES__.length>0,null,{timeout:150000});
   const cycles=await page.evaluate(()=>window.__LIVE_CYCLES__);assert.equal(cycles.length,1);
   for(let i=0;i<30;i++){if(!(await rpc('is_running')).body.result)break;await new Promise(resolve=>setTimeout(resolve,100));}
   assert.equal((await rpc('is_running')).body.result,false,'单次查询后必须暂停');
   const snapshot=(await rpc('get_snapshot')).body.result;assert.equal(snapshot.length,1);assert.notEqual(snapshot[0].lastCheckedMs,null);
   const blocked=snapshot[0].availability.kind==='unknown';
   if(blocked) {await page.locator('.exception-summary').waitFor();await page.getByText('查看原因与处理建议',{exact:true}).click();}
   await page.screenshot({path:path.join(evidence,'inventory-live-once.png'),fullPage:true});
   const report={startedAt,finishedAt:new Date().toISOString(),mode:'real Apple via existing Rust Chromium fetcher',target,cycles,snapshot,runningAfter:false,querySucceeded:!blocked,ordersExecuted:false,errors};
   await writeFile(path.join(evidence,'apple-live-result.json'),JSON.stringify(report,null,2));
   console.log(JSON.stringify({status:blocked?'真实查询已执行，但未取得可信库存':'真实库存查询通过',availability:snapshot[0].availability,requestCount:cycles[0].requestCount,paused:true}));
   await page.evaluate(()=>window.__LIVE_EVENT_ABORT__.abort());
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
