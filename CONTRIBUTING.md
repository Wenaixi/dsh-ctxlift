# 贡献指南

欢迎为 dsh-ctxlift 贡献代码、文档或问题反馈。以下约定能让你快速上手，也让我们保持一致的工程质量。

## 开发环境

- Node >= 20，pnpm >= 9
- 克隆后 `pnpm install`（会安装 dev 与 peer 依赖）
- `pnpm typecheck` / `pnpm build` / `pnpm test` 分别对应类型检查、构建（tsc + build-client）与单测（18 项）
- 隔离环境全功能验收：`pnpm test:e2e`（6 大区 10 项指标）
- 实机验收套件：`node test/verify-real-instance.mjs`（5 大域 12 项断言，含 RPC 原子落盘、SHA-1 复合指纹、ModuleLoader 契约）

## 提交规范

- 提交信息使用英文，遵循 Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:` 等），可带简短说明。
- 每个小改动独立提交，保持提交粒度小、可回溯。

## 代码约定

- 代码注释使用简体中文，文档不使用 emoji。
- 保持改动最小、职责单一；不添加未要求的功能或抽象。
- 修改引擎逻辑（`src/engine/`）时，请同步更新或补充 `test/` 下的对应单测。
- 关键契约（Config 缺失导致不激活、volatile 语义、RPC 端点自动发现、客户端 `$mount` 等）记录在项目记忆库 `CLAUDE.md`，改动涉及这些契约时请一并维护。

## 问题反馈

提交 Issue 时请说明：

- DSH 运行时版本（`dsh --version`）与 profile 形态（web / headless）
- 复现步骤与预期行为
- 相关配置与日志

## 发布流程

- 版本号遵循 SemVer。发布由 tag（`v*`）触发 `.github/workflows/publish.yml`，先确保版本号已在 `package.json` 中更新并写入 `CHANGELOG.md`。
