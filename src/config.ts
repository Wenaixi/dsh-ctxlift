/**
 * DSH 工作区指令精细化截断插件配置定义
 */

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
 * 校验并合并默认配置，保证每个字段类型健全
 */
export function resolveConfig(rawConfig?: Partial<GranularInstructionsConfig>): GranularInstructionsConfig {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return structuredClone(DEFAULT_CONFIG);
  }

  const resolvePolicy = (
    policy: Partial<FilePolicyConfig> | undefined,
    fallback: FilePolicyConfig
  ): FilePolicyConfig => {
    if (!policy || typeof policy !== 'object') {
      return { ...fallback };
    }

    const mode = VALID_MODES.includes(policy.mode as TruncateMode) ? policy.mode! : fallback.mode;
    const maxBytes =
      typeof policy.maxBytes === 'number' && policy.maxBytes > 0
        ? Math.floor(policy.maxBytes)
        : fallback.maxBytes;

    return { mode, maxBytes };
  };

  const globalPreference = VALID_PREFERENCES.includes(rawConfig.globalPreference as GlobalFilePreference)
    ? rawConfig.globalPreference!
    : DEFAULT_CONFIG.globalPreference;

  return {
    globalPreference,
    globalPolicy: resolvePolicy(rawConfig.globalPolicy, DEFAULT_CONFIG.globalPolicy),
    projectClaudePolicy: resolvePolicy(rawConfig.projectClaudePolicy, DEFAULT_CONFIG.projectClaudePolicy),
    projectAgentsPolicy: resolvePolicy(rawConfig.projectAgentsPolicy, DEFAULT_CONFIG.projectAgentsPolicy),
    subdirectoriesPolicy: resolvePolicy(rawConfig.subdirectoriesPolicy, DEFAULT_CONFIG.subdirectoriesPolicy)
  };
}
