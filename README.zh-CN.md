# dsh-ctxlift

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-Plugin-7c3aed)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%3E%3D20-5FA04E)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-F69220)](https://pnpm.io)

面向 DeepSeek Harness (DSH) 的工作区指令精细化截断插件：为全局 `AGENTS.md` / `CLAUDE.md`、项目根指令文件、子目录指令文件分别提供独立策略（不截断 / 按字节截断 / 完全禁用），并在浏览器内直接编辑全局指令文件。

## 为什么需要它

官方 `agent-instructions` 插件给所有指令文件共用一个全局字节预算。预算超限时按"从宽泛到具体"的顺序丢弃文件——**全局 `AGENTS.md` 最先被丢**——最后剩下的文件才做截断。你无法表达"全局守则永远不许截断"或"只限制项目 CLAUDE.md"这类需求。

`dsh-ctxlift` 用四个互相独立的策略层取代这种一刀切行为。

## 功能特性

- 四层独立策略，每层可选三种模式：
  - `unlimited`：完整保留，永不截断
  - `truncate`：保留开头 N 字节（UTF-8 边界安全，不产生乱码）
  - `disabled`：整层不注入
- 全局文件偏好：`auto` / `agents` / `claude` / `both`——打破官方硬编码 `USER_GLOBAL_FILE='AGENTS.md'` 的限制，支持全局 `CLAUDE.md`（或两者同时注入）。
- 浏览器内在线编辑全局指令文件（`AGENTS.md` / `CLAUDE.md`），经 RPC 服务原子落盘。未创建的文件以空白草稿呈现（纯只读无副作用），保存时自动新建。
- 每个 agent 步骤上以洋葱圈方式替换官方 `agent-instructions` 消息，策略在真实会话中生效。
- 主目录边界隔离（Home Directory Boundary Isolation）：向上寻根探测到 `os.homedir()` 立即截断且绝不将主目录本身判定为项目根，彻底防止从主目录启动会话时误载 `~/CLAUDE.md`。

## 安装

需要 DSH 运行时（`npm i -g @deepseek-ai/dsh`）。以下示例使用 `web` profile，请替换为你自己的 profile 名。

```bash
# 安装（自动 HMR 热重载）
dsh plugin --profile web add dsh-ctxlift

# 卸载
dsh plugin --profile web remove dsh-ctxlift

# 查看装配树
dsh --profile web --dump-config | grep -A2 ctxlift
```

## 配置

在设置页的插件卡片（`plugins.bundle.config` 插槽）中配置。面板分两部分：

1. **策略层**——每层一行：

   | 层 | 默认值 | 作用范围 |
   |---|---|---|
   | 全局指令（`globalPolicy`） | unlimited / 131072 字节 | `~/.dsh/AGENTS.md` / `CLAUDE.md`，所有会话 |
   | 项目根 CLAUDE.md（`projectClaudePolicy`） | truncate / 65536 字节 | `<项目>/CLAUDE.md`、`CLAUDE.local.md` |
   | 项目根 AGENTS.md（`projectAgentsPolicy`） | truncate / 65536 字节 | `<项目>/AGENTS.md`、`AGENTS.local.md` |
   | 子目录指令（`subdirectoriesPolicy`） | truncate / 32768 字节 | 深层子目录中的 `CLAUDE.md` / `AGENTS.md` |

2. **全局文件偏好**——`auto` / `agents` / `claude` / `both`，外加一个编辑器页签，可直接在浏览器中读写当前全局文件。

配置由宿主通过官方 `ConfigForms` 通道持久化（`profiles/<name>/cordis.patch.yml`），带 revision 冲突保护。全局文件内容是插件侧唯一允许的磁盘写，采用临时文件 + rename 原子落盘。

## 架构

```
src/
├── index.ts           Host 入口：导出 { name, inject, Config, apply }；
│                      组装 coordinator 并通过 ctx.plugin 挂载 RPC 服务
├── config.ts          Config Schema（schemastery，全字段 volatile、无默认值）；
│                      DEFAULT_CONFIG + resolveConfig（引擎归一）
├── remote.ts          InstructionsGuardService extends TypertRemoteService，
│                      @Remote('getGlobalInfo'|'saveGlobalContent'|'switchGlobalFilename')
└── engine/            render.ts（UTF-8 安全截断）、files.ts（文件发现）、
                       coordinator.ts（agent/pre-step 洋葱圈替换）
scripts/
└── build-client.mjs   生成 lib/client.js（window.__ModuleLoader__.load 形态），
                       $mount 远端描述符并注册配置面板
locale/                zh.json / en.json
```

关键契约（均经 DSH 真实源码核实）：

- `Config = Schema.object({...})` —— 缺 Config 就没有 settings 命名空间，插件不会激活。
- 全字段 `.volatile()` 且不给 Schema 默认值，"未配置"与"显式写入"可区分。
- 宿主 RPC 端点由 `ctx.plugin(TypertRemoteService 子类)` 自动发现。
- 客户端 bundle 必须显式 `ctx.remote.$mount(...)` 自己的描述符——宿主只挂载内置官方贡献。
- 客户端需要 `inject: ['slots', 'locale', 'configForms', 'remote']`。

## 开发

```bash
pnpm install          # 安装 dev + peer 依赖
pnpm typecheck        # tsc --noEmit
pnpm build            # tsc 输出 lib/，scripts/build-client.mjs 生成 lib/client.js
pnpm test             # node --test test/*.test.mjs（16 项单测）
node test/e2e/isolated-real-acceptance.mjs   # 隔离环境全功能验收
```

## 兼容性

- Node >= 20
- DSH 运行时 `>=0.2.0-rc.1 <=0.2.1`
- pnpm >= 9（lockfile v9）

## 许可证

MIT，全文见 [LICENSE](./LICENSE)。