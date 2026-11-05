# Codebound 项目交接

更新：2026-11-05。

## 当前任务与版本

用户先要求同步课程数据与旧文档状态，随后明确要求新增最后一个幕「终幕」，按每幕40关制作。开发源码为0.1.0-alpha.5，共180关；终幕已经加入课程与参考解法，验证状态见FINALE-QA.md。

已发布安装版仍是Alpha.4（140关），Alpha.3保留140关免安装ZIP。当前未打包或发布Alpha.5，updates/app.json保留Alpha.4下载信息。之后是否打包、发布或发送文件，按用户新的明确指令处理。

## 产品边界

- 本仓库仅维护Windows EXE，Python是本体内置主线。
- 网页位于独立YzWushao/codebound_web仓库，本轮未改网页。
- 其他语言未来放在dlc/<language-id>/，目前没有C/C++课程与运行器。
- 公开资料使用相对路径，机器目录与快捷方式记录只放在被Git忽略的.local中。

## 课程与本轮改动

- 序幕20关；第一幕「校园救援」、第二幕「信号迷城」、第三幕「程序工具箱」各40关，原140关ID不变。
- 终幕「独立远征」为141～180关，四区各10关：策略指挥室、递归信标塔、机器人学院、远征控制室。
- 策略区学习枚举、模拟、前缀和、二分；递归区学习结束条件、逐层返回与小规模双分支调用。
- 对象区学习class、实例属性、初始化、方法、状态独立、对象列表与数据转换。
- 项目区逐步组合解析、验证、模块、对象、统计、回归测试、JSON保存、恢复和最终行动。
- 40关均有讲解、不同任务的示例、起始骨架、三级提示、参考解法及至少两个变式。
- 运行桥识别真实递归、指定函数调用、实例创建；变量回放显示实例属性，递归错误提供中文提示。
- JSON评分允许保留损坏文件原文，也继续接受合法JSON的不同排版。
- 第一幕第2关解释price是单价、count是数量，起始代码加入中文注释。
- 更新区域简介、课程清单、README、架构与接续文档，冒险总览从幕数据计算数量。

## 代码与运行

content/python/campaign.json为课程入口，tests/solutions.json保存参考解法。
src/main.js负责UI、保存、关卡和回放；src/core.js负责判定、存档和语言接口。
public/runtime_bridge.py负责Python动作、追踪、模块与虚拟文件；public/runner.worker.js管理Pyodide。
desktop/main.cjs与preload.cjs提供内部协议与受限IPC。

npm ci安装依赖，npm run dev构建并运行桌面，npm test验证，npm run build构建内嵌资源，npm run package:win打包。Node.js需22.12+，测试需要Python 3；打包后的玩家不需另装运行时。

Launch-Codebound.cmd运行已有便携构建；旧EXE不会因源码更新自动获得终幕，当前180关需从源码启动。

## 兼容与验收

schemaVersion=1及codebound.save.v1不变。保存真实完成、解锁、草稿、提示、设置、模块草稿和档案快照。完成旧版第140关的存档可开启终幕首关；仅解锁旧140关不伪造新完成。

本轮基线159项检查通过；新增内容后211项全量检查、内嵌构建和终幕桌面冒烟通过，包含真实Pyodide全部180关与变式。具体证据见FINALE-QA.md，历史Alpha.4安装升级结果见INSTALLER-QA.md。勿把历史记录说成本轮安装包验证。

完整零基础真人逐关试玩、DPI、大字号、专门算法动画、图形测试编辑器与调用栈面板尚待完善。原Win11测试者exit(1)根因与复测未确认，不修改防火墙或组织策略。

## 接续

先读AGENTS.md、FINALE-QA.md、KNOWLEDGE-MAP.md、CURRICULUM-ROADMAP.md与PROJECT-TODO.md，检查Git状态并保留已有修改。

GitHub为YzWushao/Codebound。本轮源码和文档的提交同步情况以当前Git状态为准；新电脑需携带未提交文件。按用户最新任务继续，不自动扩大到打包、创建Release或发送给他人。
