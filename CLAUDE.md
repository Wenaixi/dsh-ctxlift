# dsh-ctxlift (DSH 工作区指令精细化截断与全局文件管理插件)

本项目是针对 DeepSeek Harness (DSH) 官方工作区指令插件（`@deepseek-ai/dsh-agent-instructions`）的增强插件：精细控制全局 `AGENTS.md` / `CLAUDE.md` 与项目根指令文件的截断（不截断 / 截断到多少字节 / 完全禁用），并在 Web 设置中心在线编辑全局指令文件、突破官方硬编码 `USER_GLOBAL_FILE='AGENTS.md'` 的限制支持全局 `CLAUDE.md`。

## 一、核心价值与设计目标

1. 精细化截断策略：
   - 官方插件存在全局字节预算超标时粗暴优先丢弃全局 `AGENTS.md` 的缺陷；
   - 本插件为全局文件、项目根 `CLAUDE.md`、项目根 `AGENTS.md`、子目录指令分别提供独立策略（`unlimited` / `truncate` / `disabled`）；
   - 截断算法严格保证 UTF-8 字符边界，杜绝截断导致乱码。
2. 全局文件偏好：`auto` / `agents` / `claude` / `both` 四态，`both` 时两个全局文件同时注入。
3. Web UI：
   - 设置中心「插件」详情页（`plugins.bundle.config` 插槽，key 为包名 `dsh-ctxlift`）提供策略卡片 + 全局文件在线编辑器；
   - 编辑器保存走 `saveGlobalContent` RPC，临时文件 + `renameSync` 原子写盘；
   - 配置写入走官方 ConfigForms：单次原子 ops（`{op:'set'|'unset', path, value?}`），宿主自动持久化回写 `cordis.patch.yml`。

## 二、架构（当前事实，重构后）

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
locale/               // zh.json / en.json（键：panel/pref/policy.globalPolicy.* 等，与 build-client LAYERS 对齐）
```

关键契约（全部经真实源码核实）：
- **Config 缺失 = settings 命名空间缺失**（插件不激活的第一号根因）。必须 `export const Config = Schema.object({...})` 且导出在 `export default {name, inject, Config, apply}` 里。
- volatile 字段**不设 Schema 默认值**，区分「未配置」与「显式写入」；宿主校验后 volatile 字段是带 `.get()` 的访问器，引擎侧用 `readVolatile` 解包（`src/config.ts` 的 `VolatileRef<T>`）。
- 宿主 RPC 端点由 `ctx.plugin(TypertRemoteService 子类)` 自动发现（网关 `dsh-api-gateway/lib/index.js` 遍历 `typertRemote` 绑定），**不需要** `ctx.get('typertRemote').register(...)`。
- `@Remote('methodName')` 必须字符串形式（标准装饰器，experimentalDecorators=false）。
- 客户端必须 `ctx.remote.$mount(描述符)` 显式贡献命名空间（宿主只对编译期写死的官方贡献自动 mount）；带参方法的 descriptor `parameters` 必须写全 `{name, wire, source:'json', codec:{mode:'strict',...}}`，零参可省略。
- 客户端产物必须是 `window.__ModuleLoader__.load({id, factory})` 形态（普通 ESM/CJS 被 client-runner 跳过）。
- 客户端 `exports.inject=['slots','locale','configForms','remote']`，否则纯净实例冷启动 `ctx.slots` undefined → entry failed。
- 配置写入唯一通道是 ConfigForms `form.mutate(ops, revision)`（`{op:'set'|'unset'}`，不是 `type`）；宿主自动持久化回写 patch yml，插件侧**不要去写磁盘**。
- 全局文件落盘（编辑器）是唯一允许的插件侧磁盘写，必须原子写（temp + renameSync + Windows 回退），且保存前强校验 `typeof payload.content === 'string'`。

## 三、安全红线（事故教训，必须遵守）

1. **绝不用空载荷探测写类 RPC**。`saveGlobalContent` 曾被空 `{args:{}}` 静默当空字符串覆写用户全局 `AGENTS.md`（5581 字节全局守则丢失）。防御：方法入口抛 `saveGlobalContent requires a string "content" field; refusing to write`；探测一律用最小无害写或只读端点。
2. **curl 发中文 JSON 必须 `--data-binary @file` + UTF-8 请求体**，严禁 shell 内联字符串（Windows GBK 转码会写乱码文件）。
3. 全局文件恢复：`C:/Users/Administrator/.dsh/AGENTS.md` 正式内容备份在 `E:/newCC/aaa-dsh-go/dsh-ctxlift/.dsh-acceptance/AGENTS.md.bak`（md5 c0a1c1544397b40abac725fa98b4caba，5581 字节）；校验用 `cmp` / md5，不只看字节数。
4. 浏览器自动化（browser-harness / CDP）：
   - `js()` 表达式不能内联 `\n`（用 `String.fromCharCode(10)`）；返回值非 Latin1 要 `btoa(unescape(encodeURIComponent(s)))` 编码；Python 侧一律 `json.dumps(ensure_ascii=True)`。
   - 中文按钮文案精确匹配：编辑器保存按钮是「保存更改」4 字。
   - React 受控 textarea 写入：`HTMLTextAreaElement.prototype` 的 value setter + dispatch `input` 事件。
5. headless 验证形态：`dsh.cmd --profile headless "<task>"`（headless 是 profile 名，不是子命令）；凭据 `C:/Users/Administrator/.dsh/.credentials.yaml` 的 `refs.DEEPSEEK_API_KEY`，环境变量为空需显式导出。

## 四、隔离验收环境（测试用，勿删错）

- `test-ctxlift`（web 形态）：`C:/Users/Administrator/.dsh/profiles/test-ctxlift`；`node_modules/dsh-ctxlift` 为 junction → `E:/newCC/aaa-dsh-go/dsh-ctxlift`；bundles `[dsh-base, dsh-web-app, dsh-ctxlift]`；`cordis.patch.yml` 已清为只有 `ui-settings-general` 的 welcomeNoticeVersion。
- `ctxlift-headless`（headless 形态）：同构 profile，bundles `[dsh-base, dsh-headless, dsh-ctxlift]`；用于真实 LLM 会话内截断注入验证（truncate 300 字节处断开 + `[Workspace instruction truncated...]` 提示 + disabled 只见 CLAUDE.md + unlimited 两文件齐全，三态已实测通过）。
- 热装/热卸在运行中实例上直接改 `package.json` bundles 数组即可（chokidar 2s 防抖后热重载）；命名空间回读真值（settings/describe 21 ↔ 20 个、RPC getGlobalInfo 通→404）。
- 验收配置切换：直接改写 profile 的 `cordis.patch.yml` 里 `globalPolicy.mode` 后重跑 headless 会话，无需重启。

## 五、验证基线与测试

- 构建：`npx tsc -p tsconfig.build.json && node scripts/build-client.mjs`；测试：`node --test test/*.test.mjs`（当前 13/13 通过）。
- 测试文件：`coordinator.test.mjs` / `files.test.mjs` / `files_remote.test.mjs`（InstructionsGuardService 构造已随 TypertRemoteService 化改为 `new InstructionsGuardService(new Context(), customDshHome)`）/ `render.test.mjs` / `e2e/isolated-real-acceptance.mjs`（node:vm 沙箱验证 client bundle 装配契约）。
- 验收证据链（全部已过）：装配树 `--dump-config` 含 `# == dsh-ctxlift`；settings/describe 21 命名空间含 dsh-ctxlift；RPC 信封 `{type:'server-response', result:{ok:true, value}}`；浏览器卡片全渲染（全局偏好 4 项、三层策略 number 65536/65536/32768、AGENTS.md/CLAUDE.md/保存更改 三按钮）；编辑器保存 5616 字节落盘含标记；热装卸载命名空间 21↔20 恢复。