/**
 * DSH 工作区指令精细化截断插件配置定义
 */
/** 默认配置：全局不截断，项目层按 64KB / 32KB 截断 */
export const DEFAULT_CONFIG = {
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
const VALID_MODES = ['unlimited', 'truncate', 'disabled'];
const VALID_PREFERENCES = ['auto', 'agents', 'claude', 'both'];
/**
 * 校验并合并默认配置，保证每个字段类型健全
 */
export function resolveConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        return structuredClone(DEFAULT_CONFIG);
    }
    const resolvePolicy = (policy, fallback) => {
        if (!policy || typeof policy !== 'object') {
            return { ...fallback };
        }
        const mode = VALID_MODES.includes(policy.mode) ? policy.mode : fallback.mode;
        const maxBytes = typeof policy.maxBytes === 'number' && policy.maxBytes > 0
            ? Math.floor(policy.maxBytes)
            : fallback.maxBytes;
        return { mode, maxBytes };
    };
    const globalPreference = VALID_PREFERENCES.includes(rawConfig.globalPreference)
        ? rawConfig.globalPreference
        : DEFAULT_CONFIG.globalPreference;
    return {
        globalPreference,
        globalPolicy: resolvePolicy(rawConfig.globalPolicy, DEFAULT_CONFIG.globalPolicy),
        projectClaudePolicy: resolvePolicy(rawConfig.projectClaudePolicy, DEFAULT_CONFIG.projectClaudePolicy),
        projectAgentsPolicy: resolvePolicy(rawConfig.projectAgentsPolicy, DEFAULT_CONFIG.projectAgentsPolicy),
        subdirectoriesPolicy: resolvePolicy(rawConfig.subdirectoriesPolicy, DEFAULT_CONFIG.subdirectoriesPolicy)
    };
}
//# sourceMappingURL=config.js.map