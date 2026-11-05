# Codebound · 码境远征

写下代码，开启下一关。

Codebound是面向零基础学习者的Windows编程闯关游戏。Python是内置主线，每关提供中文讲解、示例代码、起始代码和三级提示。

## 课程与版本

当前开发源码为0.1.0-alpha.5，共180关：序幕20关，第一幕「校园救援」、第二幕「信号迷城」、第三幕「程序工具箱」和终幕「独立远征」各40关。

终幕分为策略指挥室、递归信标塔、机器人学院、远征控制室，依次练习枚举、前缀和、二分、递归、类与对象，再完成解析、验证、统计和JSON保存的毕业项目。

查看[各幕知识点](docs/KNOWLEDGE-MAP.md)、[完整课程清单](docs/CURRICULUM-ROADMAP.md)和[终幕验证记录](docs/FINALE-QA.md)。

最近已发布的安装版仍是[Alpha.4](https://github.com/YzWushao/Codebound/releases/tag/v0.1.0-alpha.4)，包含140关；Alpha.3另提供140关免安装ZIP。新增终幕尚未打包发行，需使用当前源码运行。

## 开发与运行

开发需要Node.js 22.12+，测试还使用Python 3。

~~~powershell
git clone https://github.com/YzWushao/Codebound.git
cd Codebound
npm ci
npm run dev
~~~

首次安装依赖需要联网；准备脚本会将Pyodide资源复制进本地。npm run dev构建内嵌界面后启动Electron。打包后的游戏无需另装Python或Node.js，可离线游玩。

~~~powershell
npm test
npm run build
npm run package:win
~~~

构建输出在dist，Windows打包输出在release。完整保留同目录资源后可运行release/win-unpacked/Codebound.exe；Launch-Codebound.cmd启动已有的便携构建，只有重新构建后的EXE才包含新增终幕。

## 已有功能

- 真实Pyodide/CPython解释器、机器人地图、运行与逐步回放、暂停和停止。
- 变量与实例属性查看、中文错误、循环步骤限制、递归提示和输入变式。
- 按幕导航、可收起侧栏与窗口自动缩放。
- 本地进度、草稿、提示和设置保存，支持JSON导入导出；旧关卡ID与存档版本保持兼容。
- 模块编辑、虚拟文件树、JSON文件评分与档案快照。
- C/C++语言包目录及运行器接口；当前未提供其他语言课程与执行器。

## 桌面与网页边界

本仓库仅维护Windows EXE。Electron内嵌HTML/CSS/JavaScript、Worker和Pyodide属于桌面源码，构建后由codebound://app/加载，不启动本地HTTP监听服务。

Python网页版在独立YzWushao/codebound_web仓库维护，两个仓库分别安装、构建和发布。本仓库不包含网站发布流程。

Python内容随本体更新；未来其他语言放在dlc/<language-id>/，维护独立语言包版本与兼容要求。应用更新清单和DLC清单分开保存。

## 安装与更新

Alpha.4的Setup.exe识别有效安装记录，已有安装时沿用原位置升级，未安装时显示向导；升级保留进度，同版本可修复安装。详见[安装升级记录](docs/INSTALLER-QA.md)。

这是下载新版Setup.exe后运行的升级入口。应用内自动下载、签名验证与安装更新仍待实现，客户端不携带GitHub凭据。updates/app.json记录最近已发布安装包，不提前指向尚未发行的Alpha.5。

## 验证与维护

npm test检查全部关卡参考解法、变式、真实Pyodide、运行时完整性、存档兼容、递归与对象教学要求。完整真人逐关试玩和进一步DPI体验仍待完成。

项目进度见[TODO](docs/PROJECT-TODO.md)，接续开发见[交接摘要](docs/HANDOFF.md)。历史发行验证保留在对应QA文档中。

源码启动若提示资源缺失或损坏，请重新执行npm ci与npm run dev，仍有错误时展开运行器诊断。原Win11测试者的exit(1)根因和复测尚未确认。

依赖包括Electron、CodeMirror、Lucide、Vite与Pyodide，分发时保留对应许可。项目本身的发布许可由项目所有者决定。
