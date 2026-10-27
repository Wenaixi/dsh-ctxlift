# dsh-ctxlift (DSH 工作区指令精细化截断与全局文件管理插件)

针对 DeepSeek Harness (DSH) 官方工作区指令插件（`@deepseek-ai/dsh-agent-instructions`）的增强插件：精细控制全局及项目各层指令文件的独立截断（不截断 / 指定字节截断 / 完全禁用），并在 Web 设置中心在线编辑全局指令文件、支持全局 `CLAUDE.md` 与缺失文件自动创建。

## 一、核心价值与机制设计

1. **四层独立截断策略**：
   - 官方单预算超标优先丢弃全局文件的缺陷被彻底根治；
   - 为全局指令（`globalPolicy`）、项目根 `CLAUDE.md`（`projectClaudePolicy`）、项目根 `AGENTS.md`（`projectAgentsPolicy`）、深层子目录指令（`subdirectoriesPolicy`）提供完全独立的策略（`unlimited` / `truncate` / `disabled`）；
   - 截断算法严格按 UTF-8 字符边界对齐，杜绝乱码。
2. **全局文件偏好与双模支持**：
   - 提供 `auto` / `agents` / `claude` / `both` 四态，突破官方硬编码 `USER_GLOBAL_FILE='AGENTS.md'` 限制；`both` 时两份全局指令同时注入。
3. **Web 端在线编辑器与安全生命周期**：
   - 位于设置中心「插件」详情页（`plugins.bundle.config` 插槽，key 为包名 `dsh-ctxlift`）；
   - **只读选择语义**：切换到未创建的文件（如缺失 `CLAUDE.md`）返回空草稿（`exists: false`），零磁盘副作用；
   - **保存惰性创建**：输入内容点击保存后，走 `saveGlobalContent` RPC，底层通过临时文件 + `renameSync` 原子落盘并自动创建新文件，就地刷新状态。
4. **配置双向持久化**：
   - 遵循官方 ConfigForms 范式（单次原子 ops `{op:'set'|'unset', path, value?}`），宿主自动回写 `cordis.patch.yml` 并带 revision 冲突保护。

## 二、架构事实契约

```
src/
├── index.ts          // Host 入口：export default {name, inject, Config, apply}；装配 coordinator + ctx.plugin(InstructionsGuardService)
├── config.ts         // export const Config = Schema.object({...})（全字段 volatile，无默认值）；DEFAULT_CONFIG + resolveConfig(engine 归一)；resolvePluginConfig(readVolatile 解包)
├── remote.ts         // InstructionsGuardService extends TypertRemoteService；@Remote('getGlobalInfo'|'saveGlobalContent'|'switchGlobalFilename')
├── typert.ts         // 仅 re-export 类型
└── engine/
    ├── render.ts     // truncateUtf8Safe / processFileWithPolicy / renderGranularInstructionSet（<system-reminder> 结构）
    ├── files.ts      // getDshHomeDir / resolveGlobalInstructionFile / findProjectRoot / discoverInstructionFiles
    └── coordinator.ts // InstructionCoordinator：agent/pre-step 洋葱圈替换官方 agent-instructions 消息
scripts/
└── build-client.mjs // 生成 lib/client.js：window.__ModuleLoader__.load({id:'dsh-ctxlift', factory})
locale/               // zh.json / en.json（键：panel/pref/policy.*，与 build-client LAYERS 严格对齐）
```

- **Config 命名空间约束**：宿主入口必须导出 `Config` Schema（全字段 volatile，无默认值），否则 settings 命名空间缺失导致插件不激活。
- **TypertRemoteService 发现**：宿主 RPC 由 `ctx.plugin(InstructionsGuardService)` 自动发现；带参 RPC 的客户端描述符必须显式声明完整参数 codec。
- **ModuleLoader 客户端形态**：产物必须是 `window.__ModuleLoader__.load({id, factory})`；客户端显式声明 `inject=['slots','locale','configForms','remote']`。

## 三、安全红线（严格遵守）

1. **写类 RPC 强类型防御**：`saveGlobalContent` 必须第一行校验 `typeof payload.content === 'string'`，杜绝空载荷覆写用户数据。
2. **只读选择无副作用**：`switchGlobalFilename` 纯只读，绝不写占位文件或自动克隆模板。
3. **全局文件防篡改**：正式环境全局文件在测试前后必须校验 md5/备份还原，严禁用真实全局文件跑破坏性测试。
4. **Windows GBK 终端防乱码**：自动化测试涉及中文 JSON 必须走二进制文件请求体（`--data-binary @file`），严禁 shell 字符串内联。

## 四、隔离验收环境

- **`test-ctxlift` (Web 实例)**：`C:/Users/Administrator/.dsh/profiles/test-ctxlift`；node_modules 为 junction 软链；用于 Web 卡片、RPC、HMR 与设置面板验收。
- **`ctxlift-headless` (Headless 实例)**：用于真实会话中 agent 步骤的洋葱圈截断与多策略注入验证。
- **真机装配树判据**：`dsh.cmd --profile <profile> --dump-config` 必须明确命中 `# == dsh-ctxlift`。

## 五、验证基线与质量门禁

- **构建**：`pnpm build` (`tsc -p tsconfig.build.json && node scripts/build-client.mjs`)
- **类型检查**：`pnpm typecheck` (`tsc --noEmit`)
- **单元测试**：`pnpm test` (`node --test test/*.test.mjs`，13/13 通过)
- **E2E 隔离全功能验收**：`pnpm test:e2e` (`node test/e2e/isolated-real-acceptance.mjs`，6 大功能区 10 项严苛指标 100% 通过)
