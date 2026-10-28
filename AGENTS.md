# Codebound Windows 桌面版

- 此仓库只维护 Windows EXE 的源码、资源、Python 主线和其他语言 DLC 接口。
- Electron 内嵌界面的 HTML、CSS、JavaScript、Worker 和 Pyodide 属于桌面源码，使用 Vite 构建后由 `codebound://app/` 加载。
- 独立网页版维护在 `YzWushao/codebound_web`（本地相邻目录 `D:/Desktop/codebound_web`）。网页功能、网页预览和网站部署配置应在该仓库修改。
- 本仓库使用 `npm run dev` 启动桌面开发版本，使用 `npm run package:win` 构建 Windows 安装包；不要加入网页发行脚本或部署流程。
- Python 是本体内置内容；其他语言扩展保留在本仓库 `dlc/<language-id>/` 下。
- 保持现有关卡 ID 与存档协议兼容，避免重置玩家进度。
