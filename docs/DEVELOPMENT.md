# 首次部署与停止方法

本页给首次搭建环境的人使用。部署完成后的选品和查询，请看[新手使用教程](GETTING_STARTED.md)，日常不需要重跑依赖安装或全部测试。

目前提供源码运行；GitHub 的「Download ZIP」下载的是源码，不是可双击安装的应用。尚未完成正式安装、卸载验收的构建包，不作为新手的一键安装方案。

## Windows 环境准备

需要安装：

1. Git，用于下载源码。
2. Node.js 24，安装后终端应能执行 `node --version` 和 `npm --version`。
3. pnpm。项目 CI 使用 pnpm 9，可用 `npm install --global pnpm@9` 安装，然后运行 `pnpm --version` 检查。
4. Rust stable 的 MSVC 工具链，终端应能执行 `rustc --version` 和 `cargo --version`。
5. Microsoft C++ Build Tools，勾选「使用 C++ 的桌面开发」及 Windows SDK。
6. Chrome 或 Edge，供本机库存查询使用。原生桌面模式另外需要 WebView2。

安装环境后重新打开 PowerShell，让终端识别新命令。遇到“无法识别命令”，先检查对应工具是否安装成功，不要反复执行后续命令。

macOS/Linux 的系统编译依赖不同，不能直接照搬 Windows 环境准备。本页不承诺这些平台已完成本机运行验收。

## 首次启动真实查询入口

打开 PowerShell，进入你准备存放项目的目录。下面的命令逐行执行，每行成功后再执行下一行：

```powershell
git clone https://github.com/ffeus/prism-stock.git
cd prism-stock
pnpm install --frozen-lockfile
pnpm inventory:build
pnpm inventory:dev
```

首次 Rust 编译可能需要较长时间。看到错误时应停下来保留完整错误，不要把编译失败当作已经启动。

启动成功后，终端会显示本地地址和“本机 Rust 库存服务已就绪”。使用终端实际显示的地址打开页面，再按[新手使用教程](GETTING_STARTED.md)添加任务。

**保持这个终端运行。** 关闭它会停止服务。该入口只监听本机，不是部署在 GitHub 上的在线网站，也不能把本地地址直接发给其他人的电脑使用。不要修改为公网监听。

## 下一次怎么启动

打开 PowerShell，进入已有的 `prism-stock` 项目目录，执行：

```powershell
pnpm inventory:dev
```

一般不需要重新 clone 或安装依赖。升级源码或修改 Rust 代码后，应先停止服务，按变更重新安装依赖或执行 `pnpm inventory:build`，再启动。Windows 运行中的 exe 可能被锁定，不要边运行边覆盖它。

重新启动默认暂停，不会自动访问 Apple；打开页面后自行检查任务并启动查询。

## 暂停与完全停止

- **暂停查询**：在页面顶部点击「暂停监控」，保留页面和服务。
- **完全停止服务**：回到启动终端按 Ctrl+C；如果询问是否终止批处理，输入 Y 并回车。
- **浏览器模式关闭页面**：所有实时页面断开约 10 秒后暂停查询，但不等于退出终端服务。
- **原生桌面模式**：关闭窗口可能只是进入托盘，完全退出请使用应用托盘的退出菜单。

不要按进程名批量结束 Chrome、Edge 或应用进程，以免影响其他浏览器和软件。

## 其他入口不要混用

| 命令 | 作用 |
|---|---|
| `pnpm inventory:dev` | 本机真实库存查询，需要先构建 helper |
| `pnpm preview:mock` | 离线演示，不查真实库存 |
| `pnpm dev` | 普通前端开发页，单独启动不包含 Rust 后端 |
| `pnpm tauri dev` | 原生桌面开发模式，使用独立的桌面数据目录 |

库存查询浏览器模式不开放登录、推送或下单；不要在其他入口测试真实订单来判断它是否已启动成功。

## 常见启动错误

- **找不到库存服务 exe**：先停止终端，执行 `pnpm inventory:build`，确认构建成功后再启动。
- **缺少 linker、link.exe 或 Windows SDK**：检查 C++ Build Tools 安装项，并在能使用 MSVC 的终端构建。
- **端口被占用**：可能已经有服务在运行。先检查原来的启动终端；不要随意终止不明进程或改端口后把多个服务指向同一浏览器资料目录。
- **缺少 Chrome/Edge 或浏览器启动失败**：安装受支持的浏览器，保留启动诊断；不要删除已有账号资料或普通浏览器配置。
- **页面能开但查询失败**：展开异常原因。网页连通、Rust 服务连通和 Apple 接口查询成功是三件不同的事。

本机设置保存在独立目录，不自动导入其他应用数据。升级前应确认正在使用的数据目录；没有明确备份与迁移方案时，不要删除目录。

[返回首页](../README.md) · [新手使用教程](GETTING_STARTED.md)
