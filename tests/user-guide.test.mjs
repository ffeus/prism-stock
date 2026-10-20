import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('README 先讲新手使用，再展示开发者部署，不重新放入本机地址',async()=>{
 const readme=await read('README.md');
 assert.ok(readme.indexOf('## 新手第一次使用')>=0);
 assert.ok(readme.indexOf('## 新手第一次使用')<readme.indexOf('git clone'));
 assert.match(readme,/docs\/GETTING_STARTED\.md/);
 assert.match(readme,/docs\/DEVELOPMENT\.md/);
 assert.doesNotMatch(readme,/127\.0\.0\.1|localhost/);
 await access(new URL('docs/GETTING_STARTED.md',root));
 await access(new URL('docs/DEVELOPMENT.md',root));
});

test('新手教程准确区分单次查询、模拟模式和未开放的交易能力',async()=>{
 const guide=await read('docs/GETTING_STARTED.md');
 for(const label of ['商品管理','购买地区','选择具体配置','选择零售店','添加 1 项','监控任务','查询一次','开始监控','暂停监控','最后检查'])assert.ok(guide.includes(label),label);
 assert.match(guide,/查询一次完成后自动暂停/);
 assert.match(guide,/60 秒/);
 assert.match(guide,/最多 20 条/);
 assert.match(guide,/HTTP 541/);
 assert.match(guide,/未知.*不等于无货|不等于无货/);
 assert.match(guide,/离线预览/);
 assert.match(guide,/不开放结账/);
 assert.match(guide,/不能.*真实.*成功/);
 assert.match(guide,/关闭全部实时页面.*10 秒/);
});
