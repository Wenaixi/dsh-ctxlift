# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的格式。

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
