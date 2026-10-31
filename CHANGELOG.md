# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的格式。

## [0.2.1] - 2026-10-31

### 视觉与品牌规范（Branding & Icon Integration）

- **正式插件图标集成**：正式启用「漂游灯笼（Drifting Lantern）」艺术图标，放置于根目录 `dsh-ctxlift.png`。
- **高保真规格压缩**：原始体积由 818 KiB 压缩至 196.2 KiB（200,927 字节），采用 512×512 Retina 高清抗锯齿采样，严格满足 DSH 宿主 `MAX_ICON_BYTES = 256 * 1024`（256 KiB）体积上限，并保留约 61 KiB 安全余量，杜绝宿主抛出元数据错误。
- **Manifest 相对路径声明**：在 `package.json` 顶层添加 `"icon": "dsh-ctxlift.png"`，并将图标加入 `files` 发布白名单，宿主读取后自动转码为 Base64 Data URL 供 Web 清单渲染。
- **图标自动化契约测试**：新增 `test/icon.test.mjs`（3 项专项单测），严格断言文件存在性、相对路径格式、256 KiB 字节上限与 Base64 可逆解码。
- **探索素材安全归档**：将未选中的 13 张历史参考图移动至 `archive-icons/`，并在 `.gitignore` 中将其忽略，保证仓库与发布包体纯净。

## [0.2.0] - 2026-10-31

### 架构深度化重构（Deep Module Refactor）

- **缓存失效缝隙**：`InstructionCoordinator` 新增语义化 `invalidateCache()` 方法，`tools/result` 写文件事件仅清除渲染缓存而不再回滚动态 volatile 配置，彻底消除写指令文件后配置被启动闭包值覆盖的隐蔽 Bug。
- **存储与传输解耦**：将原来内嵌在 Typert Remote 服务中的临时文件与原子重命名落盘逻辑下沉为 `files.ts` 的 `saveGlobalInstructionFile` 领域函数，`remote.ts` 蜕变为纯 RPC 薄适配器（移除 `fs`/`path` 直接依赖），存储逻辑可脱离 Cordis 上下文独立单测。
- **配置统一解析缝隙**：`resolveConfig` 具身深度解析，原生吸收 volatile `.get()` 访问器或裸对象；`readVolatile` 与 `resolvePluginConfig` 收敛为内部实现，调用方统一只面向 `resolveConfig`。
- **复合摘要指纹防误判**：渲染缓存指纹由「文件路径+长度」升级为包含 `workspaceDir`、路径、长度与 SHA-1 内容摘要的复合签名，等长文本修改也会被正确感知并强制重新渲染。
- **死代码剪枝**：移除无调用者的 `getAgentsHomeDir` 导出；`build-client.mjs` 不再手工复制策略默认值，改为直接复用 `lib/config.js` 的 `DEFAULT_CONFIG` 单一事实来源，阻断前后端默认值静默漂移。

### 测试与验收

- 单元测试扩展至 18 项（新增 `invalidateCache` 防配置回滚专项、`saveGlobalInstructionFile` 领域原子写入独立测试）。
- 新增 `test/verify-real-instance.mjs` 全功能实机验收套件：5 大功能域 12 项严苛断言全部通过。
- 在全新隔离实例 `test-ctxlift-real` 中完成冷装配与 Web 客户端产物分发验证，真实 Web 服务下 `lib/client.js` 正确由宿主分发。

## [0.1.3] - 2026-10-29

### 修复与安全性增强

- 主目录边界隔离（Home Directory Boundary Isolation）：向上递归寻根算法 `findProjectRoot` 在到达 `os.homedir()` 时强制中止向上穿透；当 fallback 命中主目录自身时返回其父目录，彻底禁止将用户主目录本身判定为工程项目根目录。
- 严禁误载主目录 `~/CLAUDE.md`：当会话工作目录（cwd）直接为用户主目录时，`discoverInstructionFiles` 强制排除 `~/CLAUDE.md` 与主目录根级项目指令，仅加载用户全局指令（`$DSH_HOME/AGENTS.md`），消除主目录下庞大历史环境文件对普通会话的无意污染。
- 新增专项测试与全量回归：在 `test/files.test.mjs` 中新增主目录寻根截断与主目录排除 `~/CLAUDE.md` 的专项断言，全套 16 项测试与 E2E 验收 100% 绿色通过。

## [0.1.2] - 2026-10-28

### 修复

- 修复上游 `flatMap` 崩溃缺陷：洋葱圈协调器在自主合成与原地替换 `agent-instructions` 消息时，严格强制为 `source` 提供合法数组 `changes: []`，彻底消除官方插件在后续步（多 step）触发 baseline 替换时调用 `visibleBaseline.changes.flatMap` 抛出的 `Cannot read properties of undefined (reading 'flatMap')` 崩溃。
- 新增专项单测：严密断言注入消息的 `source.changes` 严格为数组且支持 `.flatMap()`。

## [0.1.1] - 2026-10-28

### 新增

- 全局指令编辑器只读选择语义：点击未创建的全局文件（如缺失的 `CLAUDE.md`）时，前端编辑器直接显示空白草稿，杜绝在点击时自动克隆或创建占位脏文件。
- 保存时自动创建：在空白草稿中输入内容点击「保存更改」后，底层临时文件与原子 rename 会自动新建并持久化该全局文件，并原位刷新当前选中文件状态。

### 优化

- `switchGlobalFilename` 纯只读化：移除 `copyExisting` 逻辑，返回完整的目标文件存在性（`exists`）、内容（`content`）与字节数（`bytes`）。
- 前端 Store 状态闭环：保存成功后链式触发目标项刷新，防止保存后跳回默认选项。
- 完善 CI 工作流与测试断言：覆盖缺失文件空内容只读呈现与保存自动创建的专项单测及 E2E 验证。

## [0.1.0] - 2026-10-27

首个发布版本。完成官方范式重构与隔离实例全量验收。

### 新增

- 四层独立截断策略：全局（`globalPolicy`）、项目根 `CLAUDE.md`（`projectClaudePolicy`）、项目根 `AGENTS.md`（`projectAgentsPolicy`）、子目录（`subdirectoriesPolicy`），每层支持 `unlimited` / `truncate` / `disabled`。
- 全局文件偏好：`auto` / `agents` / `claude` / `both`，打破官方硬编码 `USER_GLOBAL_FILE='AGENTS.md'` 的限制。
- 浏览器内在线编辑全局指令文件（`AGENTS.md` / `CLAUDE.md`），经 RPC 服务原子落盘。
- 按官方范式重构：`Config` Schema（schemastery，全字段 volatile、无默认值）、`InstructionsGuardService extends TypertRemoteService` + `@Remote`、`ctx.plugin` 挂载、`scripts/build-client.mjs` 生成 ModuleLoader 客户端产物、`configForms.whileServed + plugins.bundle.config` 配置面板。
- 配置写入统一为官方 `{op:'set'|'unset'}` 通道，宿主持久化回写 `cordis.patch.yml` 并带 revision 冲突保护。

### 修复

- 插件"装配但未激活"根因：缺失 `Config` Schema 导致 settings 命名空间缺失；客户端产物非 ModuleLoader 形态被 client-runner 跳过；错误使用 `typertRemote.register` 手写注册。
- `saveGlobalContent` 增加强校验：拒绝非字符串内容，杜绝空载荷覆写用户全局文件。

### 验证

- 13 项单测全绿；隔离环境全功能验收（E2E）10 项标准全过。
- 隔离实例真机验收：settings 命名空间出现 `dsh-ctxlift`、浏览器面板渲染、编辑器保存落盘字节校验、四层截断策略独立生效（17/17）、真实 agent 会话三态（truncate / disabled / unlimited）实测。
- 冷装 / 热装 / 热卸载验收通过。