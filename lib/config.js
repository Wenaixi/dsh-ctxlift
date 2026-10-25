/**
 * DSH Workspace Instructions Granular Truncation Plugin Configuration
 */
export const DEFAULT_CONFIG = {
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
export function resolveConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        return { ...DEFAULT_CONFIG };
    }
    const resolvePolicy = (policy, fallback) => {
        if (!policy || typeof policy !== 'object') {
            return { ...fallback };
        }
        const mode = ['unlimited', 'truncate', 'disabled'].includes(policy.mode)
            ? policy.mode
            : fallback.mode;
        const maxBytes = typeof policy.maxBytes === 'number' && policy.maxBytes > 0
            ? Math.floor(policy.maxBytes)
            : fallback.maxBytes;
        const truncateFrom = policy.truncateFrom === 'head' ? 'head' : 'tail';
        return { mode, maxBytes, truncateFrom };
    };
    const globalPref = ['auto', 'agents', 'claude', 'both'].includes(rawConfig.globalPreference)
        ? rawConfig.globalPreference
        : DEFAULT_CONFIG.globalPreference;
    const noticePol = rawConfig.noticePolicy === 'silent' ? 'silent' : 'compact';
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
//# sourceMappingURL=config.js.map