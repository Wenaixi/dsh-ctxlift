/**
 * DSH Workspace Instructions Granular Truncation Plugin Configuration
 */

export type TruncateMode = 'unlimited' | 'truncate' | 'disabled';
export type TruncateDirection = 'tail' | 'head';
export type GlobalFilePreference = 'auto' | 'agents' | 'claude' | 'both';
export type NoticePolicy = 'compact' | 'silent';

export interface FilePolicyConfig {
  /**
   * 截断模式：
   * - unlimited: 完全不截断，完整保留
   * - truncate: 达到上限时安全截断
   * - disabled: 禁用该类型文件，不注入上下文
   */
  mode: TruncateMode;
  /**
   * 截断字节上限（当 mode 为 'truncate' 时生效）
   */
  maxBytes?: number;
  /**
   * 截断方向：
   * - tail: 保留开头，截断尾部（默认）
   * - head: 保留末尾最新内容，截断开头
   */
  truncateFrom?: TruncateDirection;
}

export interface GranularInstructionsConfig {
  /**
   * 全局指令文件名偏好：
   * - auto: 优先选择存在的全局文件（~/.dsh/CLAUDE.md 或 ~/.dsh/AGENTS.md）
   * - claude: 全局使用 CLAUDE.md
   * - agents: 全局使用 AGENTS.md
   * - both: 两者均加载（按 AGENTS.md -> CLAUDE.md 顺序拼接）
   */
  globalPreference: GlobalFilePreference;
  /**
   * 全局工作区指令策略（默认 unlimited 不截断）
   */
  globalPolicy: FilePolicyConfig;
  /**
   * 项目根目录 CLAUDE.md 策略
   */
  projectClaudePolicy: FilePolicyConfig;
  /**
   * 项目根目录 AGENTS.md 策略
   */
  projectAgentsPolicy: FilePolicyConfig;
  /**
   * 子目录嵌套指令策略
   */
  subdirectoriesPolicy: FilePolicyConfig;
  /**
   * 截断提示策略
   */
  noticePolicy: NoticePolicy;
  /**
   * 全局总硬顶兜底字节数（0 为不设总上限，完全按单文件独立预算控制）
   */
  totalMaxBytes: number;
}

export const DEFAULT_CONFIG: GranularInstructionsConfig = {
  globalPreference: 'auto',
  globalPolicy: {
    mode: 'unlimited',
    maxBytes: 131072, // 128 KB
    truncateFrom: 'tail'
  },
  projectClaudePolicy: {
    mode: 'truncate',
    maxBytes: 65536, // 64 KB
    truncateFrom: 'tail'
  },
  projectAgentsPolicy: {
    mode: 'truncate',
    maxBytes: 65536, // 64 KB
    truncateFrom: 'tail'
  },
  subdirectoriesPolicy: {
    mode: 'truncate',
    maxBytes: 32768, // 32 KB
    truncateFrom: 'tail'
  },
  noticePolicy: 'compact',
  totalMaxBytes: 0
};

/**
 * 校验并合并默认配置，保证所有字段类型完备健全
 */
export function resolveConfig(rawConfig?: Partial<GranularInstructionsConfig>): GranularInstructionsConfig {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const resolvePolicy = (
    policy: Partial<FilePolicyConfig> | undefined,
    fallback: FilePolicyConfig
  ): FilePolicyConfig => {
    if (!policy || typeof policy !== 'object') {
      return { ...fallback };
    }
    const mode: TruncateMode = ['unlimited', 'truncate', 'disabled'].includes(policy.mode as string)
      ? policy.mode!
      : fallback.mode;
    const maxBytes = typeof policy.maxBytes === 'number' && policy.maxBytes > 0
      ? Math.floor(policy.maxBytes)
      : fallback.maxBytes;
    const truncateFrom: TruncateDirection = policy.truncateFrom === 'head' ? 'head' : 'tail';

    return { mode, maxBytes, truncateFrom };
  };

  const globalPref: GlobalFilePreference = ['auto', 'agents', 'claude', 'both'].includes(rawConfig.globalPreference as string)
    ? rawConfig.globalPreference!
    : DEFAULT_CONFIG.globalPreference;

  const noticePol: NoticePolicy = rawConfig.noticePolicy === 'silent' ? 'silent' : 'compact';
  const totalMax = typeof rawConfig.totalMaxBytes === 'number' && rawConfig.totalMaxBytes >= 0
    ? Math.floor(rawConfig.totalMaxBytes)
    : 0;

  return {
    globalPreference: globalPref,
    globalPolicy: resolvePolicy(rawConfig.globalPolicy, DEFAULT_CONFIG.globalPolicy),
    projectClaudePolicy: resolvePolicy(rawConfig.projectClaudePolicy, DEFAULT_CONFIG.projectClaudePolicy),
    projectAgentsPolicy: resolvePolicy(rawConfig.projectAgentsPolicy, DEFAULT_CONFIG.projectAgentsPolicy),
    subdirectoriesPolicy: resolvePolicy(rawConfig.subdirectoriesPolicy, DEFAULT_CONFIG.subdirectoriesPolicy),
    noticePolicy: noticePol,
    totalMaxBytes: totalMax
  };
}
