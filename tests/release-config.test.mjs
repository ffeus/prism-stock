import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("Linux 包名使用合法 ASCII 标识且保留中文桌面名称", async () => {
  const config = JSON.parse(await readFile(new URL("src-tauri/tauri.linux.conf.json", root), "utf8"));
  assert.match(config.productName, /^[a-z0-9][a-z0-9+.-]*$/);
  assert.equal(config.productName, "prism-stock");

  const desktop = await readFile(new URL("src-tauri/linux/guodao-radar.desktop.hbs", root), "utf8");
  assert.match(desktop, /^Name=棱镜库存$/m);
});

test("公开资产使用稳定 ASCII 文件名，产品文档不指向其他项目的安装包", async () => {
  const workflow = await readFile(new URL(".github/workflows/release.yml", root), "utf8");
  const readme = await readFile(new URL("README.md", root), "utf8");
  assert.match(workflow, /releaseAssetNamePattern: "\[mainBinaryName\]_\[version\]_\[arch\]\[setup\]\[ext\]"/);
  assert.match(workflow, /dpkg-query -W.*guodao-radar/);
  assert.match(workflow, /if: github.repository == 'suversal\/apple-store-inventory-monitor'/);
  assert.match(readme, /github\.com\/ffeus\/prism-stock/);
  assert.doesNotMatch(readme, /github\.com\/suversal\/[^\s)]+\/releases/);
});

test("README 没有工作站地址或冗长开发背景，同时保留完整许可入口", async () => {
  const readme = await readFile(new URL("README.md", root), "utf8");
  assert.doesNotMatch(readme, /127\.0\.0\.1|localhost|公开衍生版|源码基准|7f9e86d/);
  assert.match(readme, /\[LICENSE\]\(LICENSE\)/);
  assert.match(readme, /\[NOTICE\]\(NOTICE\)/);
  const notice = await readFile(new URL("NOTICE", root), "utf8");
  assert.match(notice, /suversal\/apple-store-inventory-monitor/);
  assert.match(notice, /ENCHIGO\/apple-pickup-watcher/);
});
