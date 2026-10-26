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
/**
 * 解开一个 volatile 字段：有 get() 就调用，否则原样返回。
 * 单测与 headless 宿主可能传裸值，两种形态都要认。
 */
export function readVolatile(value) {
    if (value && typeof value === 'object' && typeof value.get === 'function') {
        return value.get();
    }
    return value;
}
/**
 * 把宿主交给 apply 的原始配置解开成普通对象，再交给 resolveConfig 归一。
 * 这是引擎唯一入口，保证四处 policy 都拿到确定的值。
 */
export function resolvePluginConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        return resolveConfig();
    }
    return resolveConfig({
        globalPreference: readVolatile(rawConfig.globalPreference),
        globalPolicy: readVolatile(rawConfig.globalPolicy),
        projectClaudePolicy: readVolatile(rawConfig.projectClaudePolicy),
        projectAgentsPolicy: readVolatile(rawConfig.projectAgentsPolicy),
        subdirectoriesPolicy: readVolatile(rawConfig.subdirectoriesPolicy)
    });
}
//# sourceMappingURL=config.js.map