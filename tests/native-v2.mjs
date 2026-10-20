// Real Windows WebView2 + real Rust IPC. No Mock imports, no Apple requests.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import net from 'node:net';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
await mkdir(path.resolve('../.audit-tools'),{recursive:true});
const root=await mkdtemp(path.resolve('../.audit-tools/v2-native-'));
const executable=path.resolve('target/debug/apple-store-inventory-monitor.exe');
const results=[],errors=[],external=[]; let app,browser,page,viewportMetrics;
const report=path.resolve('docs/v2/evidence');
await mkdir(report,{recursive:true});
const test=async(name,action)=>{try{await action();results.push({name,result:'passed'});console.log('PASS '+name);}catch(error){results.push({name,result:'failed',error:String(error)});throw error;}};
async function launch(){
 const port=await new Promise((resolve,reject)=>{const socket=net.createServer();socket.on('error',reject);socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});
 app=spawn(executable,[],{env:{...process.env,APW_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+port+' --force-renderer-accessibility=complete --disable-gpu'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 app.stderr.on('data',data=>{const line=data.toString();if(!/DevTools listening/.test(line)) process.stderr.write(data);});
 let endpoint;
 for(let i=0;i<100;i++){try{endpoint=await (await fetch('http://127.0.0.1:'+port+'/json/version')).json();if(endpoint.webSocketDebuggerUrl) break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
 if(!endpoint?.webSocketDebuggerUrl)throw new Error('WebView2 调试端口未就绪');
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
 const context=browser.contexts()[0];
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(['tauri.localhost','ipc.localhost','127.0.0.1','localhost'].includes(url.hostname)||!['http:','https:'].includes(url.protocol))return route.continue();external.push(url.origin+url.pathname);return route.abort();});
 for(let i=0;i<50;i++){page=context.pages().find(page=>/tauri|localhost/.test(page.url()));if(page)break;await new Promise(resolve=>setTimeout(resolve,200));}
 if(!page)throw new Error('未找到原生主页面');
 page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
 await page.getByRole('navigation',{name:'主导航'}).waitFor();
 viewportMetrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio,theme:document.documentElement.classList.contains('dark')?'dark':'light'}));
 assert.equal(await page.evaluate(()=>!!window.__PRISM_TEST__),false,'native must not use the preview fixture');
}
async function stop(){await browser?.close().catch(()=>{}); if(app&&app.exitCode===null){app.kill();await new Promise(resolve=>{app.once('exit',resolve);setTimeout(resolve,3000);});}}
const nav=async name=>{await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,level:1,exact:true}).waitFor();};
const select=async(name,value)=>{await page.getByRole('combobox',{name,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();};
try{
 await test('隔离 Windows 应用启动，真实 WebView2 与 IPC',async()=>{await launch();await page.getByRole('heading',{name:'等待首次查询'}).waitFor();assert.equal(await page.getByRole('button',{name:'开始监控',exact:true}).isDisabled(),true);await page.screenshot({path:path.join(report,'native-dashboard.png'),fullPage:true});});
 await test('原生完整目录、创建任务并写入隔离配置',async()=>{await nav('商品管理');await page.getByRole('button',{name:'iPhone 18 Pro 16 个配置',exact:true}).click();await page.getByRole('button',{name:/选择具体配置/}).click();await page.getByRole('checkbox').first().check();await page.keyboard.press('Escape');await select('选择城市 / 区域','上海');await page.getByRole('button',{name:/选择零售店/}).click();await page.getByRole('checkbox').first().check();await page.keyboard.press('Escape');await page.getByRole('button',{name:'添加 1 项',exact:true}).click();await page.locator('.task-table-row').waitFor();const settings=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));assert.equal(settings.targets.length,1);assert.equal(settings.checkout.placeOrder,false);await page.screenshot({path:path.join(report,'native-tasks.png'),fullPage:true});});
 await test('原生设置保存和七页导航',async()=>{for(const name of ['历史记录','通知中心','自动结账','系统设置']) await nav(name);await page.getByLabel('查询间隔（秒）').fill('45');await page.getByRole('button',{name:'保存间隔'}).click();await page.getByText('查询间隔已保存',{exact:true}).waitFor();await page.getByRole('button',{name:/当前.*切换为/}).first().click();await page.screenshot({path:path.join(report,'native-settings.png'),fullPage:true});});
 await test('原生进程重启后任务与设置恢复，默认不自动启动查询',async()=>{await stop();await launch();await nav('监控任务');assert.equal(await page.locator('.task-table-row').count(),1);await page.getByRole('button',{name:'开始监控',exact:true}).waitFor();await nav('系统设置');assert.equal(await page.getByLabel('查询间隔（秒）').inputValue(),'45');const settings=JSON.parse(await readFile(path.join(root,'settings.json'),'utf8'));assert.equal(settings.checkout.enabled,false);assert.equal(settings.checkout.placeOrder,false);});
 await test('原生测试没有 Mock、页面异常或 Apple 外部请求',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
}catch(error){console.error(error);try{await page?.screenshot({path:path.join(report,'native-failure.png'),fullPage:true});}catch{}process.exitCode=1;}
finally{await stop();await writeFile(path.join(report,'native-v2-results.json'),JSON.stringify({environment:'Windows WebView2, actual Rust IPC, debug isolated identifier, no live Apple queries',executable,isolatedRoot:root,viewportMetrics,results,errors,externalRequests:external,limitations:['未运行真实库存查询、Bark 投递或结账试跑','未安装正式安装包；未验证托盘退出或主动切换系统 DPI','进程重启使用测试进程终止，不代表优雅退出清理通过']},null,2));}
