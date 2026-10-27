# dsh-ctxlift

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-Plugin-7c3aed)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%3E%3D20-5FA04E)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-F69220)](https://pnpm.io)

A DeepSeek Harness (DSH) plugin that gives you fine-grained control over workspace instruction injection: independent truncation policies for the global `AGENTS.md` / `CLAUDE.md`, project-root instruction files, and subdirectory instruction files — plus an in-browser editor for global instruction files.

## Why

The official `agent-instructions` plugin shares one global byte budget across all instruction files. When the budget is exceeded it drops files in order of specificity — the **global `AGENTS.md` is discarded first** — and only truncates what is left. There is no way to say "never truncate the global rules" or "cap only the project `CLAUDE.md`".

`dsh-ctxlift` replaces that one-size-fits-all behavior with four independent policy layers.

## Features

- Four independent policy layers, each with its own mode:
  - `unlimited` — keep the whole file, never truncate
  - `truncate` — keep the first N bytes (UTF-8 safe, no broken characters)
  - `disabled` — do not inject this layer at all
- Global file preference: `auto` / `agents` / `claude` / `both` — breaks the official hardcoded `USER_GLOBAL_FILE='AGENTS.md'` limit and supports a global `CLAUDE.md` (or both files at once).
- In-browser editor for global instruction files (`AGENTS.md` / `CLAUDE.md`) with atomic writes through an RPC service. Missing files open as clean empty drafts with zero disk side effects and are created automatically on save.
- Onion-skin replacement of the official `agent-instructions` messages on every agent step, so your policies take effect in real sessions.

## Install

Requires the DSH runtime (`npm i -g @deepseek-ai/dsh`). Examples use the `web` profile; substitute your own profile name.

```bash
# Install (automatic HMR reload)
dsh plugin --profile web add dsh-ctxlift

# Remove
dsh plugin --profile web remove dsh-ctxlift

# Inspect composed patch tree
dsh --profile web --dump-config | grep -A2 ctxlift
```

## Configuration

Open the plugin card in the settings page (the `plugins.bundle.config` slot). The panel has two parts:

1. **Policy layers** — one row per layer:

   | Layer | Default | Scope |
   |---|---|---|
   | Global (`globalPolicy`) | unlimited, 131072 bytes | `~/.dsh/AGENTS.md` / `CLAUDE.md`, every session |
   | Project root CLAUDE.md (`projectClaudePolicy`) | truncate, 65536 bytes | `<project>/CLAUDE.md`, `CLAUDE.local.md` |
   | Project root AGENTS.md (`projectAgentsPolicy`) | truncate, 65536 bytes | `<project>/AGENTS.md`, `AGENTS.local.md` |
   | Subdirectories (`subdirectoriesPolicy`) | truncate, 32768 bytes | `CLAUDE.md` / `AGENTS.md` in nested subdirectories |

2. **Global file preference** — `auto` / `agents` / `claude` / `both`, plus an editor tab that reads and writes the active global file directly from the browser.

Configuration is persisted by the host through the official `ConfigForms` channel (`profiles/<name>/cordis.patch.yml`), with revision conflict protection. Global file content is the only plugin-side disk write and uses an atomic temp-file + rename.

## Architecture

```
src/
├── index.ts           Host entry: exports { name, inject, Config, apply };
│                      assembles the coordinator and mounts the RPC service via ctx.plugin
├── config.ts          Config Schema (schemastery, all fields volatile, no defaults);
│                      DEFAULT_CONFIG + resolveConfig for the engine
├── remote.ts          InstructionsGuardService extends TypertRemoteService,
│                      @Remote('getGlobalInfo'|'saveGlobalContent'|'switchGlobalFilename')
└── engine/            render.ts (UTF-8-safe truncation), files.ts (discovery),
                       coordinator.ts (agent/pre-step onion-skin replacement)
scripts/
└── build-client.mjs   Generates lib/client.js as a window.__ModuleLoader__.load bundle
                       that $mounts the remote descriptors and registers the config panel
locale/                zh.json / en.json
```

Key contracts (verified against DSH source):

- `Config = Schema.object({...})` — a missing Config means no settings namespace, and the plugin never activates.
- All fields are `.volatile()` without Schema defaults, so "unconfigured" is distinguishable from an explicit write.
- Host RPC endpoints are discovered automatically from the `TypertRemoteService` subclass mounted via `ctx.plugin(...)`.
- The client bundle must explicitly `ctx.remote.$mount(...)` its descriptors — the host only mounts the built-in official contributions.
- The client needs `inject: ['slots', 'locale', 'configForms', 'remote']`.

## Development

```bash
pnpm install          # installs dev + peer dependencies
pnpm typecheck        # tsc --noEmit
pnpm build            # tsc into lib/, scripts/build-client.mjs generates lib/client.js
pnpm test             # node --test test/*.test.mjs (13 unit tests)
node test/e2e/isolated-real-acceptance.mjs   # isolated full-function acceptance
```

## Compatibility

- Node >= 20
- DSH runtime `>=0.2.0-rc.1 <=0.2.1`
- pnpm >= 9 (lockfile v9)

## License

MIT. Full text in [LICENSE](./LICENSE).