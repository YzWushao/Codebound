# Codebound 项目交接

更新：2026-11-01。

## 当前要求与状态

用户已要求制作第一幕，并追加“第二、第三幕都做”；之后要求侧栏收起和主界面无需滚动、自动缩放。用户最新要求“打包、发布，给本地运行入口，不要安装包”，已替代之前的“先不生成”。本次交付免安装ZIP与本地游戏EXE入口。

当前工作区为 Codebound 仓库；发行代码提交af4aa243fbee073391988be297366b0861216335，标签v0.1.0-alpha.3，包含140关。源码与文档已推送，公开GitHub Release已发布Alpha.3免安装ZIP。

## 产品边界

本仓库只维护Windows EXE。Python是内置主线，随本体更新；其他语言保留dlc目录和接口。网页版在独立YzWushao/codebound_web仓库及相邻本地目录，本轮未改网页。

## 本轮源码

- 原序幕20关ID不变，新增第一、二、三幕各40关，共140关。
- content/python/campaign.json 包含课程与幕元数据；tests/solutions.json 包含全部参考解法。
- 三幕涵盖基础数据处理、函数、容器、基础算法、调试测试、异常、模块、虚拟文件和JSON。
- public/runtime_bridge.py 支持每次执行隔离的内存文本文件和自定义模块；可使用math、random、json。
- src/core.js 支持文件评分、JSON语义比较、实际函数调用检查及可选挑战跳过。
- src/main.js 支持按幕选区域、收起侧栏、视口自动缩放、模块编辑、档案预览和快照。
- 保留save schemaVersion=1及codebound.save.v1；新增可选moduleDrafts与projectFiles字段。桌面仍写userData/progress.v1.json。
- 文件评分每次使用独立副本；快照可保存并导出导入，但不会自动注入评分输入。
- src/file-workspace.js 为文件与模块关提供虚拟文件树：代码文件、虚拟档案、快照分组，可点击预览、编辑模块、显示待生成文件并更新运行结果。桌面已验证真实运行、文件生成与快照入口。

## 验证与限制

158项自动检查通过，包含全部参考解法和变式、真实Pyodide、旧存档及新增运行能力。Electron桌面冒烟验证导航、模块入口、虚拟档案和第140关真实Worker执行；三个窗口尺寸与侧栏收起恢复通过。详见ALPHA3-QA.md。

真人逐关试玩、进一步DPI/大字号体验与完整安装升级卸载回归待做。专门的算法动画、图形测试编辑器和调用栈面板仍属后续TODO，不能以课程已存在替代功能完成。

历史Alpha.2曾为exit(1)问题增加运行资源校验与初始化诊断，原出错电脑根因和复测尚未确认。不要修改防火墙或组织管理策略来解决游戏问题。

## 构建与打包

npm ci 安装，npm run dev构建并运行桌面，npm test验证，npm run build仅构建内嵌资源。用户最新已授权打包发布；本次构建免安装ZIP，不上传较早的60关Setup安装包。

release目录内较早生成的Alpha.3安装包只含当时的60关，不能作为140关版交付。最新源码仅构建验证，后续打包需按用户新的要求执行。

## 文档与接续

- CURRICULUM-ROADMAP.md：140关设计；旧100关设计在archive中。
- PROJECT-TODO.md：全部待办，逐关项保留未勾选表示完整试玩验收尚未完成。
- ALPHA3-QA.md：本轮已测内容和实际限制，是当前状态的详细记录。
- CONTINUE-PROMPT.md：新会话提示。

下一步按用户最新要求继续修订与试玩。不要自动推送、发消息或发布。跨电脑备份要带上未提交文档和源码，仅克隆远程仓库不能获得本轮成果。本交接不包含其他项目服务器信息或凭据。

当前发行目标：v0.1.0-alpha.3；验证与校验值见ALPHA3-QA.md和releases/0.1.0-alpha.3.md，实际发布状态以GitHub Release为准。

发布结果（2026-11-01）：[https://github.com/YzWushao/Codebound/releases/tag/v0.1.0-alpha.3](https://github.com/YzWushao/Codebound/releases/tag/v0.1.0-alpha.3)，GitHub预发行，Release ID 430433063。ZIP为161809815字节，服务器SHA-256与本地一致。本地直接入口：release/win-unpacked/Codebound.exe，也可使用桌面游戏快捷方式。
