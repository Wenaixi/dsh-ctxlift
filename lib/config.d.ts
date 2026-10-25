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
export declare const DEFAULT_CONFIG: GranularInstructionsConfig;
/**
 * 校验并合并默认配置，保证所有字段类型完备健全
 */
export declare function resolveConfig(rawConfig?: Partial<GranularInstructionsConfig>): GranularInstructionsConfig;
//# sourceMappingURL=config.d.ts.map