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
 * 校验并合并默认配置，保证每个字段类型健全。
 * 深模块设计：原生吸收 volatile 访问器或普通对象，调用方无需在外部手动解包。
 */
export function resolveConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        return structuredClone(DEFAULT_CONFIG);
    }
    const raw = rawConfig;
    const resolvePolicy = (rawPolicyInput, fallback) => {
        const policy = readVolatile(rawPolicyInput);
        if (!policy || typeof policy !== 'object') {
            return { ...fallback };
        }
        const rawMode = readVolatile(policy.mode);
        const mode = VALID_MODES.includes(rawMode) ? rawMode : fallback.mode;
        const rawMaxBytes = readVolatile(policy.maxBytes);
        const maxBytes = typeof rawMaxBytes === 'number' && rawMaxBytes > 0
            ? Math.floor(rawMaxBytes)
            : fallback.maxBytes;
        return { mode, maxBytes };
    };
    const rawPref = readVolatile(raw.globalPreference);
    const globalPreference = VALID_PREFERENCES.includes(rawPref)
        ? rawPref
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
//# sourceMappingURL=config.js.map