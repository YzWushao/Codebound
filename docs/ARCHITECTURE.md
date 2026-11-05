# Codebound 内容与扩展约定

更新：2026-11-05。开发版Alpha.5含180关，最近已发行Alpha.4含140关。

## 产品与教学层级

本仓库仅维护Windows EXE。Python是内置主线，新增Python课程、素材与修复随本体发行；网页独立维护在YzWushao/codebound_web。

Python主线 → 幕 → 入门单元/任务区域 → 关卡。

序幕五个单元各4关；第一、二、三幕与终幕各有四个区域、每区10关。已有180关均在课程数据中可用，完整真人试玩仍待完成。具体知识见[课程表](KNOWLEDGE-MAP.md)。

幕导航、总览和进度按内容数据计算。固定关卡ID用于存档，新增幕不重置旧记录，也不把旧版全部解锁等同于新关卡完成。

## 运行与判定

- LanguageRegistry注册语言运行器，当前仅实现Python。
- PythonRunner.run/stop/dispose管理独立Worker、超时与结果。
- Worker初始化前校验运行资源大小和SHA-256；从已校验的内存副本加载标准库，失败时保留阶段与stderr诊断。
- 游戏桥返回行号、变量、实例属性、动作、输出、文件和错误；实例属性显示只用于学习回放，不作为任意系统对象检查器。
- 判定支持终点、收集、电量、输出、变量、AST教学构造、指定函数调用、真实递归、实例创建与文件结果。
- 真实递归通过调用帧识别。主样例检查所学构造，输入变式继续检查输出、地图和文件；递归结束条件变式允许不发生进一步调用。
- JSON文件优先接受完全相同的原文；内容不同但均合法时进行结构比较，因此既支持不同排版，也支持要求保留损坏JSON原文的练习。
- 保留追踪3000行、150动作、650事件和6秒执行超时，课程使用小输入。

## 模块、文件与存档

math、random、json及工作区同目录模块可导入。模块源文件由隔离的执行请求提供，模块草稿可保存。

文件使用内存文本工作区，仅提供文件名和r/w/a模式、UTF-8编码。每次运行及变式独立，评分不读写任意系统路径。结果文件可保存成档案快照，但快照不自动注入评分输入。

存档schemaVersion=1，保留固定ID、真实完成、解锁列表、草稿、提示、设置、模块草稿和档案快照。桌面通过受限IPC将progress.v1.json原子写入userData，渲染器缓存作为后备。

## DLC与更新接口

其他语言源文件放在dlc/<language-id>/。描述字段包括schemaVersion、id、language、version、engineApi、minAppVersion、entry、runtime。Python不能注册为DLC。

updates/app.json与updates/dlc.json独立维护。应用清单仅指向实际已发布的安装包，开发版版本号不提前覆盖发行URL。

Alpha.4安装器支持手动下载Setup.exe后的原位升级与修复，应用内自动下载、签名验证和失败恢复仍待完善。

## 桌面发行

Electron内嵌HTML/CSS/JavaScript、Worker与Pyodide由Vite构建，通过codebound://app/加载。入口要求preload，不能作为独立网页启动，也不启动本地HTTP服务。

依赖、运行时副本、日志、玩家数据和编译产物不提交Git。机器专属记录放在被忽略的.local目录；公开资料使用仓库相对路径。客户端不携带维护者的GitHub凭据。

当前终幕只更新源码与文档，未创建Alpha.5安装包或Release。完整测试与桌面验证见[终幕QA](FINALE-QA.md)，安装器历史验证见[安装QA](INSTALLER-QA.md)。
