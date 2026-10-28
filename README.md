# Codebound · 码境远征

写下代码，开启下一关。

本仓库只维护 Windows EXE 桌面版。这是面向零基础学习者的本地 Alpha。Python 是游戏内置主线；已有 20 关构成「序·幕：Byte 苏醒」，其中五个入门单元教授顺序执行、输出、变量、输入、条件、for、while 和基础累加。每关提供中文讲解、注释示例与三级提示，穿插独立 Python 练习与不同输入测试。第一幕、第二幕为后续正式冒险，当前明确标注为规划内容。

Python 网页版独立维护在 `YzWushao/codebound_web`，本地目录为 `D:/Desktop/codebound_web`。两个项目分别安装依赖、构建和发布。

## 开始

本仓库提供源码，当前尚未发布 GitHub Release 安装包。需要 Node.js 22.12+，在 Windows 上克隆后启动桌面版：

```powershell
git clone https://github.com/YzWushao/Codebound.git
cd Codebound
npm ci
npm run dev
```

首次安装需要联网；运行所需 Python 核心会复制进本地资源。`npm run dev` 构建内嵌界面后启动 Electron。

执行 `npm run package:win` 生成 Windows EXE 安装包，输出在 `release/`。构建后可运行 `release/win-unpacked/Codebound.exe`（需保留同目录资源），或使用生成的 Setup.exe 安装。打包后的游戏无需另装 Python 或 Node.js，可离线游玩。

`npm run build` 生成 `dist/` 内嵌界面资源，由 EXE 通过内部协议加载；本仓库不提供独立网页发行入口。依赖、运行时副本和编译产物不提交到 Git，安装与构建命令会生成它们。

## Alpha 已有功能

- 真实的 Python 解释器（Pyodide / CPython），在无 Node 权限的独立 Worker 中执行。
- 机器人地图、收集和充电动作；执行行高亮、变量查看、暂停、单步、停止与速度调整。
- 中文错误说明、原始错误折叠查看；死循环步骤限制与运行超时中断。
- 关卡解锁、草稿与进度自动保存，支持 JSON 导出导入。
- 桌面进度写入 Electron `app.getPath('userData')` 下的 `progress.v1.json`；客户端缓存作为恢复后备。更新本体不覆盖存档。
- 桌面资源通过 `codebound://app/` 内部协议加载，不启动 Python 服务或 HTTP 监听端口；离线游戏不需要公网入站访问。
- C/C++ 语言扩展目录、统一运行器和关卡判定接口。尚无 C/C++ 课程或执行器。

## 目录与发布约定

```text
content/python/       Python 内置主线，随本体更新
src/                  EXE 内嵌界面、编辑器、地图与判定
public/               EXE 的 Python Worker 与运行时资源
desktop/              Windows 桌面入口、存档和更新接口
dlc/<language-id>/    后续语言扩展包的独立目录
updates/              本体与 DLC 的独立发行清单
config/repository.json GitHub 来源配置
```

不同语言 DLC 维护自己的语言包版本与兼容要求。新增 Python 关卡、资源或修复属于本体新版本。网页的课程和网站更新在独立仓库维护。

## GitHub 更新状态

当前已关联公开仓库 `YzWushao/Codebound`，更新源配置已同步为公开。Alpha 提供明确的更新状态和读取接口，尚未发布 GitHub Release，也未接入发行包的签名校验、下载和自动安装。不会向玩家客户端内置 GitHub 凭据。正式启用自动更新时，需要发布可供玩家访问的发行包并接入签名验证。

客户端更新以正式构建的发行包为单位，不在玩家电脑上克隆源码或现场编译。应用清单与 DLC 清单分开维护，避免语言包发行影响本体更新通道。

## 验证

`npm test` 使用本机 Python 3 执行同一游戏桥，检查 20 关参考答案、输入变式、错误行号、循环限制与存档协议。EXE 内实际运行使用随程序打包的 Pyodide。

## 依赖与许可

依赖包括 Electron、CodeMirror、Lucide、Vite 与 Pyodide，分发时保留相应依赖许可。项目本身的发布许可由项目所有者决定。
