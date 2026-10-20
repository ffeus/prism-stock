interface Runtime { token: string; mode: string }
const runtime=()=> (window as unknown as {__PRISM_RUNTIME__?: Runtime}).__PRISM_RUNTIME__;
type Callback=(event:{payload:unknown})=>void;
const callbacks=new Map<string,Set<Callback>>();
let controller:AbortController|undefined;
let connecting:Promise<void>|undefined;
let reconnect:ReturnType<typeof setTimeout>|undefined;
const emit=(channel:string,payload:unknown)=>{for(const callback of callbacks.get(channel)??[])callback({payload});};
function scheduleReconnect(){
 clearTimeout(reconnect);
 if(!callbacks.size)return;
 reconnect=setTimeout(()=>{void ensureConnection().catch(()=>{connecting=undefined;scheduleReconnect();});},3000);
}

export async function invoke<T>(command:string,args:Record<string,unknown>={}):Promise<T>{
 const config=runtime();if(!config||config.mode!=='inventory')throw new Error('实时查询入口未正确初始化，不使用模拟库存兜底');
 const response=await fetch('/__prism/invoke',{method:'POST',headers:{'Content-Type':'application/json','X-Prism-Token':config.token},body:JSON.stringify({command,args}),signal:AbortSignal.timeout(25000)});
 const result=await response.json() as {result:T;error?:string};
 if(!response.ok||result.error)throw new Error(result.error??'本机服务不可用');
 return result.result;
}

function ensureConnection():Promise<void>{
 if(connecting)return connecting;
 controller=new AbortController();
 const signal=controller.signal;
 connecting=(async()=>{
  const config=runtime();if(!config)throw new Error('缺少本机连接参数');
  const response=await fetch('/__prism/events',{headers:{'X-Prism-Token':config.token},signal});
  if(!response.ok||!response.body)throw new Error('无法连接本机库存事件流');
  const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
  void Promise.all([invoke('get_snapshot'),invoke('get_settings'),invoke<boolean>('is_running')]).then(([rows,settings,running])=>{if(!signal.aborted){emit('watcher://snapshot',rows);emit('watcher://settings',settings);emit('watcher://event',{type:'runStateChanged',running});}}).catch(()=>{});
  void (async()=>{
   let buffer='';
   try{
    while(true){const {done,value}=await reader.read();if(done)break;buffer+=value;if(buffer.length>2*1024*1024)throw new Error('事件流消息过大');let end;while((end=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of part.split('\n'))if(line.startsWith('data: ')){const message=JSON.parse(line.slice(6)) as {channel:string;payload:unknown};emit(message.channel,message.payload);}}}
   }catch(error){if(!signal.aborted)emit('watcher://notice',String(error));}
   finally{
    reader.releaseLock();if(signal.aborted)return;connecting=undefined;
    emit('watcher://notice','本机服务连接中断，正在重连；断开期间的历史不会被伪造补写。');
    scheduleReconnect();
   }
  })();
 })().catch(error=>{connecting=undefined;throw error;});
 return connecting;
}

export async function listen<T>(channel:string,callback:(event:{payload:T})=>void):Promise<()=>void>{
 const callbacksForChannel=callbacks.get(channel)??new Set<Callback>();
 const adapted=callback as Callback;callbacksForChannel.add(adapted);callbacks.set(channel,callbacksForChannel);
 try{await ensureConnection();}catch(error){callbacksForChannel.delete(adapted);if(!callbacksForChannel.size)callbacks.delete(channel);throw error;}
 return ()=>{callbacksForChannel.delete(adapted);if(!callbacksForChannel.size)callbacks.delete(channel);if(!callbacks.size){clearTimeout(reconnect);controller?.abort();controller=undefined;connecting=undefined;}};
}

export async function openUrl(url:string):Promise<void>{
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!['github.com','www.apple.com','www.apple.com.cn'].includes(parsed.hostname))throw new Error('未允许的外部链接');
 window.open(parsed.href,'_blank','noopener,noreferrer');
}
