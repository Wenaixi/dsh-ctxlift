# Changelog

本项目所有值得记录的变更都记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.2] - 2026-11-13

### Fixed

- reject 守卫：决策被拒绝时不再对空 messages 崩溃，对齐官方 agent-instructions 的类型契约
- 逐条消息去重：增量 delta 消息不再被整轮去重误伤，四层截断对增量消息同样生效

### Added

- coordinator 新增 reject 守卫与逐条去重用例，全套 23 项测试通过

## [0.2.1] - 2026-10-31

### Added

- 正式插件图标「漂游灯笼」，体积压缩至 196 KiB
- package.json 声明 icon 字段并加入发布白名单
- 图标契约测试 3 项：文件存在性、体积上限、Base64 可逆解码

### Changed

- 未选中的历史参考图归档至 archive-icons

## [0.2.0] - 2026-10-31

### Changed

- 缓存失效：写文件仅清渲染缓存，不再回滚动态配置
- 存储与传输解耦：落盘逻辑下沉为独立领域函数，RPC 层变薄适配器
- 配置解析统一：volatile 访问器与裸对象统一收敛到 resolveConfig
- 渲染缓存指纹升级为内容摘要复合签名，等长文本修改也能正确感知
- 单测扩展至 18 项，新增实机验收套件 12 项断言

### Removed

- 无调用者的 getAgentsHomeDir 导出
- 构建脚本手工复制默认值，改为复用单一事实来源

## [0.1.3] - 2026-10-29

### Fixed

- 主目录边界隔离：寻根算法到 os.homedir() 强制中止，禁止把主目录当项目根
- 工作目录为主目录时排除 ~/CLAUDE.md，仅加载全局指令
- 新增主目录寻根截断专项测试，全套 16 项通过

## [0.1.2] - 2026-10-28

### Fixed

- 修复上游 flatMap 崩溃：合成消息强制提供 changes 数组
- 新增注入消息 changes 数组专项单测

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

### Changed

- 13 项单测全绿，隔离实例冷装 / 热装 / 卸载验收通过