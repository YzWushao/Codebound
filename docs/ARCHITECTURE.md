# Codebound Alpha 的内容与扩展约定

## 产品范围

- 本仓库仅维护 Windows EXE。Python 网页版独立维护在 `YzWushao/codebound_web`，本地相邻目录为 `D:/Desktop/codebound_web`。
- Python 不属于 DLC；新增 Python 关卡、素材与程序修复随本体版本发行。
- 其他语言作为独立 DLC，源文件放在同一仓库的 `dlc/<language-id>/` 下，预留包格式和运行器接口。
- 本体与 DLC 分别读取发行清单，后续对接 GitHub 发行包；Alpha 不执行未签名的远程安装。
- EXE 内置关卡、Python 运行时与资源均落地本机。进度和草稿独立存储，可导出迁移。
- 桌面资源采用 `codebound://app/`，不启动本地 HTTP 服务，不需要为 Python / Node 开放公网入站。

## 教学层级

`Python 主线 → 幕 → 入门单元 / 任务区域 → 关卡`

已有 20 关归入「序·幕：Byte 苏醒」。五组基础知识是序幕里的入门单元，每组四个短关卡，用于第一次接触语法。

后续第一幕「校园救援」、第二幕「信号迷城」目前为明确标注的规划入口，没有可游玩的关卡。正式幕将以更长的区域任务、练习、变式和综合挑战组织，不沿用每个章节固定四关的限制。预期一个区域 8～12 关，实际数量根据教学需要决定。

所有进度分母从内容数据计算。存档只依赖固定关卡 ID，不以关卡在列表中的位置作标识，因此新增幕和调整显示顺序不会重置已有进度。

## 接口

- `LanguageRegistry`：注册语言运行器；Python 当前已实现。
- `LanguageRunner.run(code, level, onStatus)`：返回统一的状态、行号、变量、输出、动作事件、错误和输入变式结果。
- `LanguageRunner.stop / dispose`：停止与释放执行环境。
- 关卡判定：检查终点、收集数、电量、输出、变量和教学要求；输入题运行多个数据案例。
- 存档协议：`schemaVersion`、固定关卡 ID、完成记录、草稿、提示状态、设置与更新时间。
- DLC 描述：`schemaVersion`、`id`、`language`、`version`、`engineApi`、`minAppVersion`、`entry`、`runtime`。
- 更新源：`updates/app.json` 与 `updates/dlc.json` 独立维护。未来下载、签名验证、暂存、兼容检查与安装分别实现。

## 发布

本仓库构建 Windows EXE 与安装包。Electron 的内嵌界面继续使用 HTML、CSS、JavaScript、Worker 与 Pyodide；这些文件属于桌面源码。界面入口要求 Electron preload 接口，不能作为独立网页启动。Vite 只负责生成客户端内嵌资源，不在本仓库维护网页预览或网站部署流程。

`codebound_web` 是独立的 Python 网页项目，分别维护依赖锁文件、课程副本、浏览器存储和网站构建。两个仓库不在构建时读取对方文件，后续课程改动需要按产品需要分别同步。Python 关卡 ID 与存档 schemaVersion 保持兼容，用户仍可通过 JSON 导入导出迁移进度。

运行组件通过 npm 锁定版本，构建时放入本仓库资源目录。

仓库 `YzWushao/Codebound` 已公开，维护桌面版源码、20 关 Python 序幕、DLC 接口及构建说明。依赖、运行时副本、日志和 EXE 编译产物不纳入源码提交，可通过锁文件安装与构建生成。尚未创建 GitHub Release；面向玩家的更新源需要另行发布可访问的发行包，客户端不携带维护者的 GitHub 凭据。
