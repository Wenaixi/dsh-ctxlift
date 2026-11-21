# 宿主版本兼容性（Compatibility）

本文回答一个问题：**这个插件能在哪些 DeepSeek Harness 版本上跑，以及升级宿主时该看什么。**

## 一、兼容声明的真实判定规则

DSH 宿主用 `@deepseek-ai/dsh-app-boot` 的 `evaluatePluginCompatibility` 判定插件是否可加载，规则只有两条：

1. **有 `engines.dsh` 时，只看它** —— `peerDependencies` 被完全跳过。
2. **没有 `engines.dsh` 时**，才遍历 `peerDependencies`，且只挑名字以 `@deepseek-ai/dsh` 开头或 `@deepseek-ai/dsh-` 为前缀的项。

由此推出两个容易踩的坑：

- `@deepseek-ai/cordis`、`@deepseek-ai/schemastery` 这类前缀不符的 peer **完全不参与判定**；
- 缺 `engines.dsh` 不等于「被放行」，而是换成 peer 口径——若 peer 里写的是 `"*"` 这种恒真值，等于零校验。

本插件声明 `engines.dsh: ">=0.2.2-rc.1"`，因此判定只看这一条，与 peer 无关。

预发布版本必须用 `semver.satisfies(range, { includePrerelease: true })` 才判得对。

## 二、运行时版本从哪来

`dsh --version` 输出的不是 CLI 包自身的版本，而是**安装侧 `dsh-app-boot` 的 `package.json.version`**：

```
getDshRuntimeVersion() → new URL('../package.json', import.meta.url)
```

所以「升级了 CLI」与「判定基准变成新版」必须分开核验——只有 app-boot 一起升上去，闸门用的版本才真的变了。

## 三、本插件依赖的宿主契约

| 契约 | 由谁提供 | 用途 | 稳定性 |
| --- | --- | --- | --- |
| `agent/pre-step` 事件（prepend） | `@deepseek-ai/dsh-agent` | 洋葱圈最外层拦截，`await next()` 后改写官方注入的消息 | 稳定 |
| `PreStepDecision` 两分支 | `@deepseek-ai/dsh-agent` | `{kind:'reject'}` 与 `{kind:'enter', messages}` 必须都守卫 | 稳定 |
| `agent-instructions` 消息形状 | `@deepseek-ai/dsh-agent-instructions` | `content: [{type:'text'}]` + `source.kind === 'agent-instructions'` | 稳定 |
| `ctx.get('workingDirectory')` | 宿主核心 | 取会话真实工作目录（不声明 inject，零阻碍激活） | 稳定 |

**为什么用可选访问取 `workingDirectory` 而不是 `inject`**：`inject` 里缺任一服务会让整个 fiber 不激活，插件就完全不工作了。用 `ctx.get()` 读取可以做到「服务在就用，不在就降级」。

## 四、升级宿主后的核验清单

1. `npm run test:e2e` —— 隔离实例全功能验收（6 大功能域 / 10 条判据）
2. `npm test` —— 32 项单测（含构造契约回归）
3. 真启动 web profile，确认无 `skipping profile bundle` / `disabling profile plugin`
4. 打开设置面板，确认全局文件编辑器可读写（这一步验的是 RPC 与 remote 链路）

## 五、已知的宿主行为差异

### 5.1 `ctx.plugin(Service, config)` 只传一个参数

cordis 把 `config` 交给构造函数的**第二个参数**，第三参恒为 `undefined`。本插件曾因此让 `getPreference` 落空、静默退回 `'auto'`，症状是编辑器显示的全局文件与引擎实际加载的不一致。

修法：构造改为接受 options 对象（并保留字符串位置传法作向后兼容），已由两条回归测试锁死。

### 5.2 profile 内的旧版官方包会遮蔽安装侧

模块解析在 profile 层是**本地优先**：先搜 profile 的 `node_modules`，命中即直接用，不再看安装侧。所以升级 CLI 后，profile 里残留的旧官方包仍会被优先加载。

- 带 `@deepseek-ai/dsh*` 精确 peer 的旧包 → 被闸门判不兼容，有 stderr 提示；
- 只带 `cordis` peer 的旧包 → **闸门不看它，静默加载旧代码**，最难发现。

处置：升级宿主后，把 profile 里不在安装侧依赖树中的官方包移除，让解析回落到安装侧。
