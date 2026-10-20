import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('公开衍生版有独立安装身份且不指向上游更新包',async()=>{
 const config=JSON.parse(await read('src-tauri/tauri.conf.json'));
 assert.equal(config.identifier,'com.ffeus.prism-stock');
 assert.equal(config.bundle.createUpdaterArtifacts,false);
 assert.equal(config.plugins?.updater,undefined);
 const brand=await read('src/lib/brand.ts');
 assert.match(brand,/repository: "https:\/\/github.com\/ffeus\/prism-stock"/);
 assert.match(brand,/updatesEnabled: false/);
});

test('桌面设置、目录缓存和浏览器使用衍生版目录且不自动迁移旧数据',async()=>{
 const lib=await read('src-tauri/src/lib.rs');
 const load=lib.slice(lib.indexOf('fn load_settings('),lib.indexOf('pub fn run()'));
 assert.match(load,/app_paths::root/);
 assert.doesNotMatch(load,/import_previous_version\(|import_legacy\(/);
 assert.match(await read('src-tauri/src/chromium_fetcher.rs'),/crate::app_paths::root\(\)/);
 assert.match(await read('src-tauri/src/app_paths.rs'),/prism-stock/);
});

test('上游发布流水线不能替衍生版发布原版签名和安装身份',async()=>{
 const release=await read('.github/workflows/release.yml');
 assert.match(release,/if: github.repository == 'suversal\/apple-store-inventory-monitor'/);
});
