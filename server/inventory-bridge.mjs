import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';

const allowed = new Set(['list_regions','list_categories','list_products','list_stores','get_settings','get_snapshot','is_running','check_for_update','save_settings','set_targets','set_interval','start_watching','stop_watching','retry_watching_now','query_once']);
export function requestAllowed(request, token, port) {
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(request.headers.host)) return false;
  if(request.headers['x-prism-token']!==token) return false;
  const origin=request.headers.origin;
  if(origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)) return false;
  if(request.headers['sec-fetch-site'] && request.headers['sec-fetch-site']!=='same-origin') return false;
  return true;
}

export function inventoryBridge({dataDir,port=1425,executable}={}) {
 const token=randomBytes(32).toString('hex');
 let child, sequence=0, stopped=false, unavailable='库存服务尚未就绪', idle;
 const pending=new Map(),clients=new Set();
 const rpc=(command,args={})=>new Promise((resolve,reject)=>{
  if(!allowed.has(command)) return reject(new Error('此入口未开放该操作'));
  if(unavailable||!child||child.exitCode!==null) return reject(new Error(unavailable||'库存服务已退出'));
  if(pending.size>=32) return reject(new Error('本机请求过多，请稍后重试'));
  const id=++sequence;
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('本机库存服务响应超时'));},20000);
  pending.set(id,{resolve,reject,timer});
  child.stdin.write(JSON.stringify({id,command,args})+'\n',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(new Error('库存服务连接已关闭'));}});
 });
 const broadcast=(message)=>{for(const response of clients){if(!response.write('data: '+JSON.stringify(message)+'\n\n'))response.destroy();}};
 const close=()=>{if(stopped)return;stopped=true;clearTimeout(idle);for(const response of clients)response.end();child?.stdin.end();const timer=setTimeout(()=>child?.kill(),6000);timer.unref();};
 return {
  name:'prism-readonly-inventory',
  transformIndexHtml(html){return html.replace('<body>',`<body><script>window.__PRISM_RUNTIME__=${JSON.stringify({token,mode:'inventory',minIntervalSeconds:60,maxTargets:20})}</script><div class="live-inventory-banner" role="note">本机实时库存查询 · Rust 引擎 · 仅查询不下单 · 最短 60 秒间隔</div>`);},
  configureServer(server){
   const binary=resolve(executable??('target/debug/prism-inventory-service'+(process.platform==='win32'?'.exe':'')));
   if(!existsSync(binary)) throw new Error('请先构建本机库存服务：cargo build -p apple-store-inventory-monitor --features browser-inventory-service --bin prism-inventory-service');
   child=spawn(binary,['--data-dir',resolve(dataDir??'../.audit-tools/browser-inventory')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   child.stdin.on('error',()=>{});
   child.stderr.on('data',data=>server.config.logger.warn('[库存服务] '+data.toString().trim().slice(0,1500)));
   createInterface({input:child.stdout}).on('line',line=>{
    let message;try{message=JSON.parse(line);}catch{return;}
    if(message.ready){unavailable='';server.config.logger.info('本机 Rust 库存服务已就绪，默认暂停，不自动查询 Apple');return;}
    if(message.channel){broadcast(message);return;}
    const request=pending.get(message.id);if(!request)return;clearTimeout(request.timer);pending.delete(message.id);
    if(message.ok)request.resolve(message.result);else request.reject(new Error(message.error??'本机操作失败'));
   });
   child.on('exit',()=>{unavailable='库存服务已退出，请重启本机服务；旧库存结果不代表当前状态';for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error(unavailable));}pending.clear();broadcast({channel:'watcher://notice',payload:unavailable});for(const response of clients)response.end();});
   child.on('error',()=>{unavailable='无法启动本机库存服务，请检查编译产物及权限';});
   server.httpServer?.once('close',close);
   server.middlewares.use(async(request,response,next)=>{
    const pathname=request.url?.split('?')[0];
    if(!pathname?.startsWith('/__prism/'))return next();
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    const json=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));};
    if(!requestAllowed(request,token,port))return json(403,{error:'仅允许本机页面的同源请求'});
    if(pathname==='/__prism/events'&&request.method==='GET'){
      clearTimeout(idle);response.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});response.flushHeaders();response.write(': connected\n\n');clients.add(response);
      const heartbeat=setInterval(()=>response.write(': keepalive\n\n'),15000);
      response.on('close',()=>{clearInterval(heartbeat);clients.delete(response);if(!clients.size&&!stopped){idle=setTimeout(()=>{if(!clients.size)void rpc('stop_watching').catch(()=>{});},10000);idle.unref();}});
      return;
    }
    if(pathname!=='/__prism/invoke'||request.method!=='POST')return json(404,{error:'接口不存在'});
    if(!request.headers['content-type']?.startsWith('application/json'))return json(415,{error:'必须使用 JSON 请求'});
    let size=0,parts=[];
    try{
      for await(const part of request){size+=part.length;if(size>128*1024)return json(413,{error:'请求过大'});parts.push(part);}
      const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
      if(!allowed.has(body.command))return json(403,{error:'只读库存入口不开放该操作'});
      const result=await rpc(body.command,body.args??{});
      json(200,{result});
    }catch(error){json(400,{error:error.message??'请求格式或本机操作失败'});}
   });
  },
  closeBundle:close,
 };
}
