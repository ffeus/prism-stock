# Prism Stock V2 发布与验收

日期：2026-10-20（UTC+8）。公开仓库：<https://github.com/ffeus/prism-stock>。

本文记录实际执行的测试与功能边界。本项目不是 Apple 官方软件。完整许可、版权及来源声明见 [LICENSE](../LICENSE) 和 [NOTICE](../NOTICE)。

## 已完成

- 七页中文工作台、深浅主题、中文侧栏、响应式布局；按系列/容量/颜色选择商品，按城市选择门店，多选组合添加监控，搜索/筛选/排序与详情。
- 浏览器 1425 使用本机 Rust helper，复用原 Catalog、Watcher、AppleChromiumFetcher；单次查询、定时查询、暂停、真实事件及会话记录。1427 是独立 Mock 入口。
- 默认暂停；最短 60 秒、最多 20 个组合、并发 1；541/限流保持未知并暂停，不绕过风控。
- 实时浏览器入口不执行登录、推送、购物袋、结账和付款，不读取旧版账号资料；不切换 FlClash 节点。
- 桌面安装标识改为 `com.ffeus.prism-stock`；Linux 包标识 `prism-stock`；设置、目录缓存与专属 Chromium 资料使用独立目录，不自动导入旧版数据。配置格式保持兼容，迁移需要另行确认。
- 应用内更新保持关闭；不自动安装其他发行包。本仓库不会默认运行真实 Apple 接口测试或继承的自动发布流程。
- Playwright 1.62.1 固定为开发依赖；新增离线浏览器 CI。工作站审计记录、日志、配置和凭证不发布。

## 实测结果

各类测试互不替代：Mock 成功不等于 Apple 查询成功，构建成功不等于安装/卸载验收成功。

| 检查 | 本机结果 |
|---|---|
| `pnpm install --frozen-lockfile` | 通过；新增 Playwright 使用既有工作区 store，不改全局设置 |
| `cargo fmt --all -- --check` | 通过 |
| `cargo clippy --workspace --all-targets --all-features -- -D warnings` | 通过 |
| `cargo test --workspace` | 307 通过、0 失败、20 忽略；默认未执行真实接口、购物袋或结账测试 |
| `pnpm test` | 79 通过、0 失败；包括公开文档、许可入口与新手教程回归 |
| `pnpm exec tsc --noEmit` / `pnpm build` | 通过 |
| 快照脚本 `--self-test` | 通过，不联网抓取目录 |
| `pnpm test:e2e` | Mock 浏览器 27 场景通过，外部请求拦截；包含添加/编辑/删除、多选、541、主题、设置、网络、Mock Bark 和结账 |
| `pnpm test:desktop` | Windows WebView2 + 真实 Rust IPC 5 场景通过；隔离配置保存、重启恢复、七页导航，无 Mock、无 Apple 请求 |
| 1425 实时入口连接及安全检查 | 通过；拒绝跨站、推送、订单命令及不安全配置，没有额外请求 Apple |
| 中文侧栏 | 1440/900/600/440px 七项标签可见，无横向溢出 |
| `pnpm tauri build --no-sign` | 通过，Windows x64 NSIS；未安装，不据此宣称安装测试通过 |
| 首次 GitHub CI | Linux、macOS 和离线浏览器通过；Windows 的 about:blank 浏览器生命周期测试启动超时，见下方说明，不能宣称全面通过 |

最新一次用户单独授权的 Apple 真实只读验收：2026-10-20 **15:43:21（UTC+8）**，iPhone 16 128GB 深青色（MYF03CH/A）×上海环球港（R683），返回 `out_of_stock`，原文“Apple 环球港目前不可取货”。库存请求 1 次，3657ms，完成后自动暂停。使用独立临时配置，没有覆盖使用中的监控任务。截图见 README。该结果只代表当时该目标，不保证未来或其他地区仍可查询。

结账验证严格限于本地模拟：Rust 结账模块 7 项通过、2 项真实官网测试未执行；27 项 Mock 界面场景包含试跑及真实提交确认取消。没有登录 Apple、没有访问真实购物袋、没有创建订单或付款。因此目前可以确认本机库存查询可用，但不能确认真实下单可用。

远端 [Windows CI 首次失败](https://github.com/ffeus/prism-stock/actions/runs/39386339577/job/118506976544) 发生在浏览器 12 秒启动上限，离线 Rust 测试此前已通过；本机真实查询成功不抹掉该失败。当前只补充该测试的脱敏启动诊断输出，未删除测试、放宽超时或绕过断言，根因仍待远端诊断。本机额外复验同一 about:blank 生命周期测试通过（1 项，约 1.6 秒，不访问 Apple）。远端 [离线浏览器 CI](https://github.com/ffeus/prism-stock/actions/runs/39386339567) 已通过。

本轮先用失败回归确认仍有原版安装身份、共享目录和继承发布流程风险，修复后通过。期间出现 pnpm store 路径不一致、一次导航脚本误指向未启动的 1427、GitHub EOF；分别通过沿用既有 store、明确测试 URL、核实远端状态后重试解决。未删测试、未放松断言，没有隐藏失败。

## 可复现命令

从 README 完成依赖与 helper 构建。以下命令默认不请求 Apple：

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
python crates/apw-core/data/generate.py --self-test
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
pnpm exec playwright install chromium
pnpm test:e2e
```

Windows 可用 `docs/v2/Run-Check.ps1` 保存命令/时间/退出码。脚本优先检测本机可选工作区工具链；不存在则沿用当前标准 Rust/MSVC 环境，不要求开发者拥有原工作站目录。原始日志保存在被 Git 忽略的 `docs/v2/evidence/`。

验证实时入口连接（先运行 `pnpm inventory:dev`）：

```powershell
$env:PRISM_TEST_URL='http://127.0.0.1:1425'
node tests/inventory-browser.mjs
node tests/sidebar-labels.mjs
```

**不要设置 `PRISM_ALLOW_LIVE=1`，不要运行所有 `--ignored` 或 `cargo test --all-features`。** 这些可能真实访问 Apple；必须重新取得授权。Clippy 的 `--all-features` 仅编译，不执行查询。

Windows 隔离桌面验收（不访问 Apple）：

```powershell
pnpm tauri build --debug --no-bundle --no-sign --config docs/v2/tauri.smoke.conf.json
pnpm test:desktop
```

测试创建自己的临时配置和 WebView2 目录，仅终止自己启动的进程。未验证正式安装、卸载、托盘优雅退出或所有 Windows DPI 设置。

构建桌面包（只生成，不安装）：`pnpm tauri build --no-sign`。浏览器 helper 需要单独执行 `pnpm inventory:build`，不随桌面包暴露 HTTP 服务。启动后的关闭主窗口与完全退出是不同操作，桌面完全退出请使用托盘；本机浏览器服务则在终端 Ctrl+C。

## 已知限制与优先级

1. P1：结账取消、精确 SKU/数量/价格与提交前授权仍需独立安全加固；本轮未真实验收，不建议对真实订单开启自动提交。
2. P1：敏感设置仍需 OS 凭证存储及授权迁移，不能以输入遮罩代替加密。
3. P1：长期多目标稳定性、浏览器崩溃恢复与连接状态需要持续测试；不承诺 24×7 稳定性。
4. P1：正式安装/升级/卸载与回滚、独立签名更新未验收；未签名包不能视作生产发行认证。
5. P2：历史目前仅当前会话；持久历史、变化通知去重、分组、指标和收藏为后续优先项。
6. P2：内置目录不是实时官网目录；全地区真实接口及系统代理/TUN/FlClash 组合没有完整线上验收。
7. P2：浏览器版尚无手机推送，桌面版 Bark 未真实投递；不能宣称手机已收到提醒。
8. P3：macOS/Linux 本轮未本机运行验收；其他电商平台尚未接入，不承诺任意平台抢购。

## 构建记录

Windows x64 Release 构建成功（`pnpm tauri build --no-sign`），产生 `target/release/bundle/nsis/棱镜库存_1.0.22_x64-setup.exe`。该文件只留作本机构建验收，不自动安装、不作为稳定版上传；公开交付为源码及复现步骤。安装/卸载、签名与高级功能风险完成验收前，不推荐将构建产物当作正式发行包。

该本机构建产物大小 3,937,303 字节，SHA-256：`C12FBC1E037D574E942EA37E89EF209B29CB13082533B6609D9E7292E9DE507F`。后续重新构建可能改变哈希，不代表已安装或已签名。
