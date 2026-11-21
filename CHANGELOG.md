# Changelog

本项目所有值得记录的变更都记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.4] - 2026-11-21

### Fixed

- **`getPreference` 静默退化为 `auto`**：cordis 的 `ctx.plugin(Service, config)` 只把
  `config` 交给构造函数的第二个参数，第三参恒为 `undefined`。旧签名
  `(ctx, customDshHome, getPreference)` 因此让偏好读取器落空，服务回退到 `auto`，
  导致编辑器显示的文件与引擎实际加载的不一致（偏好 `claude` 且两份都在时，
  `auto` 会选 `AGENTS.md`）。构造改为接受 `InstructionsGuardOptions` 对象，
  并保留字符串位置传法的向后兼容；新增两条回归测试锁死该契约。

## [0.2.3] - 2026-11-14

### Fixed

- `tools/result` 监听器签名错误。事件的真实签名是 `(exec, result)`，工具名在 `exec.name`；旧代码把它当单参事件对象读 `event.tool.name`，该字段不存在，判断恒为 false。结果是改完 `AGENTS.md` / `CLAUDE.md` 后渲染缓存不失效，注入的仍是旧内容。工具清单同时改为官方 `dsh-tool-fs` 的 `write` / `edit` / `apply_patch`，删掉并不存在的 `ops_replace`。
- `remote.getGlobalInfo` 硬编码 `'auto'`，忽略用户的 `globalPreference`。偏好设为 `claude` 且两份文件都存在时，Web 端编辑器显示 `AGENTS.md`，引擎实际加载 `CLAUDE.md`。
- `resolveWorkspaceDir` 的 `catch {}` 吞掉 `workingDirectory.ensure` 抛出的 `AbortError`，取消信号失效。改为只对该错误继续向上传播，其余异常仍静默回退。

## [0.2.2] - 2026-11-13

### Fixed

- reject 守卫：决策被拒绝时不再对空 messages 崩溃，对齐官方 agent-instructions 的类型契约
- 逐条消息去重：增量 delta 消息不再被整轮去重误伤，四层截断对增量消息同样生效

## [0.2.1] - 2026-10-31

### Added

- 正式插件图标「漂游灯笼」，体积压缩至 196 KiB
- package.json 声明 icon 字段并加入发布白名单

### Changed

- 未选中的历史参考图归档至 archive-icons

## [0.2.0] - 2026-10-31

### Changed

- 缓存失效：写文件仅清渲染缓存，不再回滚动态配置
- 存储与传输解耦：落盘逻辑下沉为独立领域函数，RPC 层变薄适配器
- 配置解析统一：volatile 访问器与裸对象统一收敛到 resolveConfig
- 渲染缓存指纹升级为内容摘要复合签名，等长文本修改也能正确感知

### Removed

- 无调用者的 getAgentsHomeDir 导出
- 构建脚本手工复制默认值，改为复用单一事实来源

## [0.1.3] - 2026-10-29

### Fixed

- 主目录边界隔离：寻根算法到 os.homedir() 强制中止，禁止把主目录当项目根
- 工作目录为主目录时排除 ~/CLAUDE.md，仅加载全局指令

## [0.1.2] - 2026-10-28

### Fixed

- 修复上游 flatMap 崩溃：合成消息强制提供 changes 数组

## [0.1.1] - 2026-10-28

### Added

- 全局指令编辑器只读选择语义：点击未创建文件显示空白草稿，不自动创建
- 保存时自动创建缺失文件并刷新选中状态

### Changed

- switchGlobalFilename 纯只读化，返回存在性、内容与字节数

## [0.1.0] - 2026-10-27

### Added

- 四层独立截断策略：全局、项目 CLAUDE.md、项目 AGENTS.md、子目录，各层支持 unlimited / truncate / disabled
- 全局文件偏好：auto / agents / claude / both
- 浏览器内在线编辑全局指令文件，经 RPC 原子落盘
- 配置面板与客户端产物遵循官方范式

### Fixed

- 插件装配但未激活的三个根因：缺 Config Schema、客户端产物非 ModuleLoader 形态、错误的手写注册
- 保存内容强校验，拒绝非字符串载荷