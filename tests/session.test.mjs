import test from 'node:test';
import assert from 'node:assert/strict';
import { newSession, recordCycle, recordNotification, sessionMetrics } from '../src/features/activity/session.ts';
import { safeSettingsExport } from '../src/features/settings/safeExport.ts';
const target = {locale:'zh_CN',partNumber:'TEST/A',storeNumber:'R001',storeTitle:'测试门店',productName:'测试商品'};
const row = (availability) => ({target,availability,lastCheckedMs:1000,consecutiveFailures:0});
const cycle = {cycle:1,at:1000,elapsedMs:500,requests:1,reused:0,healthy:false};

test('会话初始没有虚构查询、成功率和耗时', () => {
  assert.deepEqual(sessionMetrics(newSession(1)), {cycles:0,successRate:null,averageMs:null,requests:0});
});
test('541 保持未知且不计成功，首次观察不伪造状态变化', () => {
  const snapshot = [row({kind:'unknown',reason:'blocked',detail:'HTTP 541'})];
  const result = recordCycle(newSession(),cycle,snapshot,[]);
  assert.equal(sessionMetrics(result).successRate,0);
  assert.equal(result.observations[0].changed,false);
  snapshot[0].availability = {kind:'out_of_stock'};
  assert.equal(result.observations[0].state.availability.reason,'blocked');
});
test('从待查询进入首次结果不算库存变化', () => {
  const session = recordCycle(newSession(),cycle,[row({kind:'out_of_stock'})],[row({kind:'unknown',reason:'not_yet_checked'})]);
  assert.equal(session.observations[0].changed,false);
});
test('状态变化按完整目标区分，统计按目标加权而非轮次平均', () => {
  const old = [row({kind:'out_of_stock'})];
  let session = recordCycle(newSession(),cycle,old,[]);
  const snapshot = [row({kind:'in_stock'}),{...row({kind:'unknown',reason:'transport',detail:'超时'}),target:{...target,storeNumber:'R002'}}];
  session = recordCycle(session,{...cycle,cycle:2,elapsedMs:1000},snapshot,old);
  assert.equal(session.observations[1].changed,true);
  assert.equal(session.observations[2].changed,false);
  assert.deepEqual(sessionMetrics(session),{cycles:2,successRate:67,averageMs:750,requests:2});
});
test('会话内存严格有界，最多120轮、600结果、100提醒', () => {
  let session = newSession();
  for (let n=0;n<130;n++) session = recordCycle(session,{...cycle,cycle:n},Array.from({length:8},()=>row({kind:'out_of_stock'})),[]);
  for (let n=0;n<110;n++) session = recordNotification(session,{at:n,title:'测试',detail:'未发外网',kind:'submitted'});
  assert.equal(session.cycles.length,120); assert.equal(session.observations.length,600); assert.equal(session.notifications.length,100);
  assert.equal(new Set([...session.cycles,...session.observations,...session.notifications].map(record=>record.id)).size,820);
});
test('脱敏导出使用白名单，排除所有密钥和联系人以及未知未来字段', () => {
  const settings = {locale:'zh_CN',targets:[{...target,barkUrl:'SECRET',futureSecret:'SECRET'}],intervalSeconds:30,soundEnabled:true,openOnHit:'none',stopOnHit:false,network:{mode:'system',clash:{secret:'SECRET',controller:'SECRET'}},barkUrl:'SECRET',productBarkUrls:{x:'SECRET'},checkout:{contactEmail:'SECRET',nationalIdSuffix:'SECRET'},futureSecret:'SECRET'};
  const exported = JSON.stringify(safeSettingsExport(settings));
  assert.ok(!exported.includes('SECRET')); assert.ok(exported.includes('TEST/A')); assert.ok(!exported.includes('checkout'));
});
