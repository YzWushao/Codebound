# 语言扩展接口

Python 属于游戏本体，内容位于 `content/python/`，随本体版本发布。网页构建仅含 Python。

其他语言在 `dlc/<language-id>/` 下维护。Alpha 只提供协议与目录，不宣称已实现 C/C++ 执行器。

每个语言包包含 `manifest.json`、课程、关卡与资源。manifest 至少声明 `schemaVersion`、`id`、`language`、`version`、`engineApi`、`minAppVersion`、`entry` 和 `runtime`。运行器通过 `LanguageRunner` 协议提供 `run`、`stop`、`dispose`，输出统一的行号、变量、输出、场景动作和错误事件。运行器由宿主注册；内容包不直接拥有主进程权限。

应用发行包与 DLC 索引分开。DLC 将来由独立的签名包安装器校验、检查兼容性、暂存后启用；不通过执行包内任意安装脚本完成安装。
