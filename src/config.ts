/**
 * DSH 工作区指令精细化截断插件配置定义
 *
 * 这里同时导出两套东西，职责不同：
 * - Config（Schemastery Schema）交给宿主：决定设置命名空间长什么样、哪些字段可写。
 * - GranularInstructionsConfig / resolveConfig 交给引擎：归一成确定值，引擎不必关心缺省。
 *
 * 为什么所有字段都标 .volatile() 且不设 Schema 默认值：
 * 1. 宿主设置通道只允许写 volatile 字段，非 volatile 字段前端提交会被拒。
 * 2. 不设默认值才能区分"用户没配过"和"用户显式配了"，未配置时回落到 DEFAULT_CONFIG。
 */

import Schema from '@deepseek-ai/schemastery';

/** 单层指令文件的处理模式 */
export type TruncateMode = 'unlimited' | 'truncate' | 'disabled';

/** 全局指令文件选择偏好 */
export type GlobalFilePreference = 'auto' | 'agents' | 'claude' | 'both';

/** 单层指令文件策略 */
export interface FilePolicyConfig {
  /**
   * 处理模式：
   * - unlimited: 完全不截断，完整保留全文
   * - truncate: 超出字节上限时按 UTF-8 安全边界截断
   * - disabled: 禁用该层文件，不注入上下文
   */
  mode: TruncateMode;
  /**
   * 截断字节上限，仅在 mode 为 truncate 时生效
   */
  maxBytes?: number;
}

/** 插件完整配置 */
export interface GranularInstructionsConfig {
  /**
   * 全局指令文件名偏好：
   * - auto: 使用当前已存在的全局文件，两者都在时优先 AGENTS.md
   * - agents: 全局固定使用 AGENTS.md
   * - claude: 全局固定使用 CLAUDE.md
   * - both: 两者都加载，按 AGENTS.md 到 CLAUDE.md 的顺序拼接
   */
  globalPreference: GlobalFilePreference;
  /** 全局工作区指令策略 */
  globalPolicy: FilePolicyConfig;
  /** 项目根目录 CLAUDE.md 策略 */
  projectClaudePolicy: FilePolicyConfig;
  /** 项目根目录 AGENTS.md 策略 */
  projectAgentsPolicy: FilePolicyConfig;
  /** 子目录嵌套指令策略 */
  subdirectoriesPolicy: FilePolicyConfig;
}

/** 默认配置：全局不截断，项目层按 64KB / 32KB 截断 */
export const DEFAULT_CONFIG: GranularInstructionsConfig = {
  globalPreference: 'auto',
  globalPolicy: {
    mode: 'unlimited',
    maxBytes: 131072
  },
  projectClaudePolicy: {
    mode: 'truncate',
    maxBytes: 65536
  },
  projectAgentsPolicy: {
    mode: 'truncate',
    maxBytes: 65536
  },
  subdirectoriesPolicy: {
    mode: 'truncate',
    maxBytes: 32768
  }
};

const VALID_MODES: TruncateMode[] = ['unlimited', 'truncate', 'disabled'];
const VALID_PREFERENCES: GlobalFilePreference[] = ['auto', 'agents', 'claude', 'both'];

/**
 * 宿主可见的配置 Schema。四个 policy 是对象 volatile 字段，globalPreference 是标量 volatile。
 * 对象整体 volatile 会在解析时给整个子树包一层访问器（.get() 返回用户写下的对象字面量），
 * 引擎侧用 unwrapConfig 取出归一配置，与手写 resolveConfig 的校验完全一致。
 */
export const Config = Schema.object({
  globalPreference: Schema.union(VALID_PREFERENCES).required(false).volatile(),
  globalPolicy: Schema.object({
    mode: Schema.union(VALID_MODES).required(false),
    maxBytes: Schema.natural().min(128).required(false)
  }).required(false).volatile(),
  projectClaudePolicy: Schema.object({
    mode: Schema.union(VALID_MODES).required(false),
    maxBytes: Schema.natural().min(128).required(false)
  }).required(false).volatile(),
  projectAgentsPolicy: Schema.object({
    mode: Schema.union(VALID_MODES).required(false),
    maxBytes: Schema.natural().min(128).required(false)
  }).required(false).volatile(),
  subdirectoriesPolicy: Schema.object({
    mode: Schema.union(VALID_MODES).required(false),
    maxBytes: Schema.natural().min(128).required(false)
  }).required(false).volatile()
});

/**
 * apply 收到的配置类型。运行时 volatile 字段实际是带 .get() 的访问器对象，
 * 所以读取一律走 readVolatile，这里的类型只是"用户写下的形状"。
 */
export type Config = GranularInstructionsConfig;

/** volatile 字段在宿主里是带 get() 的访问器，单测里也可能直接传裸值 */
export interface VolatileRef<T> {
  get(): T;
}

/**
 * 解开一个 volatile 字段：有 get() 就调用，否则原样返回。
 * 单测与 headless 宿主可能传裸值，两种形态都要认。
 */
export function readVolatile<T>(value: VolatileRef<T> | T | undefined): T | undefined {
  if (value && typeof value === 'object' && typeof (value as VolatileRef<T>).get === 'function') {
    return (value as VolatileRef<T>).get();
  }
  return value as T | undefined;
}

/**
 * 校验并合并默认配置，保证每个字段类型健全。
 * 深模块设计：原生吸收 volatile 访问器或普通对象，调用方无需在外部手动解包。
 */
export function resolveConfig(rawConfig?: unknown): GranularInstructionsConfig {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return structuredClone(DEFAULT_CONFIG);
  }

  const raw = rawConfig as Record<string, unknown>;

  const resolvePolicy = (
    rawPolicyInput: unknown,
    fallback: FilePolicyConfig
  ): FilePolicyConfig => {
    const policy = readVolatile(rawPolicyInput as any) as Partial<FilePolicyConfig> | undefined;
    if (!policy || typeof policy !== 'object') {
      return { ...fallback };
    }

    const rawMode = readVolatile(policy.mode as any);
    const mode = VALID_MODES.includes(rawMode as TruncateMode) ? (rawMode as TruncateMode) : fallback.mode;

    const rawMaxBytes = readVolatile(policy.maxBytes as any);
    const maxBytes =
      typeof rawMaxBytes === 'number' && rawMaxBytes > 0
        ? Math.floor(rawMaxBytes)
        : fallback.maxBytes;

    return { mode, maxBytes };
  };

  const rawPref = readVolatile(raw.globalPreference as any);
  const globalPreference = VALID_PREFERENCES.includes(rawPref as GlobalFilePreference)
    ? (rawPref as GlobalFilePreference)
    : DEFAULT_CONFIG.globalPreference;

  return {
    globalPreference,
    globalPolicy: resolvePolicy(raw.globalPolicy, DEFAULT_CONFIG.globalPolicy),
    projectClaudePolicy: resolvePolicy(raw.projectClaudePolicy, DEFAULT_CONFIG.projectClaudePolicy),
    projectAgentsPolicy: resolvePolicy(raw.projectAgentsPolicy, DEFAULT_CONFIG.projectAgentsPolicy),
    subdirectoriesPolicy: resolvePolicy(raw.subdirectoriesPolicy, DEFAULT_CONFIG.subdirectoriesPolicy)
  };
}

/**
 * 兼容旧入口：统一委托给具备深层解包能力的 resolveConfig
 */
export const resolvePluginConfig = resolveConfig;
