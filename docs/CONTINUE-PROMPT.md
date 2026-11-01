# 新会话接续提示

> 最新状态：Alpha.4 新增统一安装/升级EXE，源码与159项检查通过；安装器集成测试覆盖首次安装、原位升级、同版本修复、失效记录回退与存档保护。详见 INSTALLER-QA.md。历史Alpha.3记录保留供回溯。
```text
继续当前工作区中的 Codebound 项目。先读 AGENTS.md、docs/HANDOFF.md、docs/ALPHA3-QA.md、docs/PROJECT-TODO.md 和 docs/CURRICULUM-ROADMAP.md，检查 git status 并保留已有修改。
本仓库只维护Windows EXE，网页在独立codebound_web仓库；Python内置，其他语言未来作为DLC。
本地Alpha.3已实现140关（序幕20、三幕各40），158项自动检查及桌面冒烟通过。包含模块草稿、虚拟文件和JSON评分、档案快照、收缩侧栏与窗口自动缩放。真人逐关试玩和完整发行验收尚待完成。
用户最新已授权打包发布；本次交付140关Windows免安装ZIP，并提供本地Codebound.exe入口。release中较早的60关包已被当前140关构建替代。GitHub已发布Alpha.3免安装版，源码及规划文档已提交推送。
请按我的最新要求继续，真实报告源码实现与待验收的区别，不把TODO中的规划功能说成已完成。
```

当前发行目标：v0.1.0-alpha.3；验证与校验值见ALPHA3-QA.md和releases/0.1.0-alpha.3.md，实际发布状态以GitHub Release为准。

发布结果（2026-11-01）：Alpha.3同一Release提供安装EXE与免安装ZIP，校验值以SHA256SUMS.txt附件为准。
