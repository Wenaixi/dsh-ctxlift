# dsh-ctxlift (DSH 工作区指令精细化截断与全局全能管理插件)

本项目是针对 DeepSeek Harness (DSH) 官方工作区指令插件（`@deepseek-ai/dsh-agent-instructions`）的增强与替代插件，提供工作区指令的精细化截断控制、全局指令文件在线编辑以及打破官方硬编码限制的全局 `CLAUDE.md` / `AGENTS.md` 自由切换支持。

## 一、核心价值与设计目标

1. 精细化截断策略：
   - 官方插件存在全局 `maxBytes` 预算超标时粗暴优先丢弃全局 `AGENTS.md` 的缺陷；
   - 本插件为全局文件、项目根目录 `CLAUDE.md`、项目根目录 `AGENTS.md`、子目录指令分别提供独立的策略控制（`unlimited` / `truncate` / `disabled`）；
   - 截断算法严格保证 UTF-8 字符边界与换行段落完整，杜绝截断导致乱码。
2. 全局文件支持 `CLAUDE.md`：
   - 突破官方硬编码 `USER_GLOBAL_FILE = "AGENTS.md"` 的限制；
   - 支持全局使用 `CLAUDE.md`、`AGENTS.md`、优先存在者、或两者合并注入。
3. Web UI 在线编辑与原子保存：
   - 在 DSH 网页端设置中心提供全局指令文件的 Markdown 在线查看与编辑；
   - 通过官方 Typert Remote RPC 规范进行跨端通信，单次原子写入磁盘；
   - 遵循操作即写与单次原子 ops 规范，杜绝 revision 锁冲突。

## 二、架构分层与模块说明

```
src/
├── index.ts                // Host 端入口，注册 Cordis 服务与插件
├── config.ts               // 插件配置 Schema 与类型定义
├── remote.ts               // Typert Remote RPC 服务实现（跨端读写全局文件）
├── engine/
│   ├── render.ts           // 纯函数渲染与截断引擎（UTF-8 安全截断）
│   ├── files.ts            // 文件发现与变动跟踪（支持 AGENTS.md / CLAUDE.md）
│   └── coordinator.ts      // agent/pre-step 洋葱圈拦截协调器
└── client/
    ├── index.tsx           // Client 端入口，注册 settings 插槽与语言包
    ├── controller.ts       // 客户端设置状态机（无 DOM 纯逻辑）
    ├── SettingsCard.tsx    // 精细截断控制卡片
    └── EditorPanel.tsx     // 全局指令在线查看与 Markdown 编辑器
```

## 三、工程规范与开发准则

1. 纯净依赖与无损构建：
   - 仅依赖官方核心协议 `@deepseek-ai/dsh-typert-protocol`、`@deepseek-ai/dsh-contracts` 与 `@deepseek-ai/dsh-client-ui-primitives`；
   - 杜绝在根目录下产生多余的 `pnpm-workspace.yaml`，防止阻断主工程构建。
2. 安全与性能：
   - 严格在 `agent/pre-step` 洋葱圈内工作，保持 `<system-reminder>` 提示词前缀稳定性，保护大模型 Prompt Cache；
   - 截断算法采用原生 Buffer 字节级安全检测，杜绝内存泄漏与非法字符逃逸。
3. 纯 Node 脱机自动化测试：
   - 所有算法与状态机均采用 `node:test` 编写单元测试；
   - 测试不依赖外部网络与实际 DSH 运行时，可纯脱机毫秒级执行。
