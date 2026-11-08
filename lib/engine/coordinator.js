/**
 * DSH Workspace Instructions Onion-Skin Step Interceptor Coordinator
 */
import crypto from 'node:crypto';
import { discoverInstructionFiles } from './files.js';
import { renderGranularInstructionSet } from './render.js';
/**
 * 解析当前步的工作目录。
 *
 * 0.2.2-rc.1 起 `agent/pre-step` 的 payload 不再提供 `agent.cwd`（`Agent`
 * 公开面只有 id，增强面也无 cwd），所以优先通过宿主 workingDirectory 服务
 * 取会话真实目录；服务缺失或调用失败时回退 payload 与 process.cwd()。
 */
async function resolveWorkspaceDir(payload, workingDirectory) {
    const agent = payload?.agent;
    if (workingDirectory !== undefined && agent !== undefined) {
        try {
            if (typeof workingDirectory.ensure === 'function') {
                const ensured = await workingDirectory.ensure(agent, payload?.signal);
                if (typeof ensured === 'string' && ensured.length > 0)
                    return ensured;
            }
            const session = agent.session;
            if (typeof workingDirectory.get === 'function' && session !== undefined) {
                const current = workingDirectory.get(session);
                if (typeof current === 'string' && current.length > 0)
                    return current;
            }
        }
        catch {
            // 服务调用失败时静默回退，避免阻断 pre-step 主流程
        }
    }
    const legacy = payload?.agent?.cwd ?? payload?.cwd ?? payload?.workspaceDir;
    return typeof legacy === 'string' && legacy.length > 0 ? legacy : process.cwd();
}
/**
 * 会话表面是否已存在相同文本的指令消息（去重闸）。
 *
 * 与官方自己用的账本一致（`agent.session.surface.nodes` + `eventAt`）：
 * 命中说明这份渲染已经进过上下文，不必再次替换，天然杜绝每轮重复追加
 * 导致的 token 膨胀；session 重放后 surface 恢复，跨重启同样有效。
 */
export function surfaceAlreadyHas(agent, text) {
    if (agent === undefined || agent === null)
        return false;
    const session = agent.session;
    const surface = session?.surface;
    const eventAt = session?.eventAt;
    if (surface?.nodes === undefined || typeof eventAt !== 'function')
        return false;
    const target = crypto.createHash('sha1').update(text).digest('hex');
    for (const seq of surface.nodes) {
        let event;
        try {
            event = eventAt(seq);
        }
        catch {
            continue;
        }
        if (event?.type !== 'user/message')
            continue;
        if (event.data?.source?.kind !== 'agent-instructions')
            continue;
        const contentText = event.data?.content
            ?.find?.((c) => c?.type === 'text')?.text;
        if (typeof contentText === 'string' && contentText.length > 0 &&
            crypto.createHash('sha1').update(contentText).digest('hex') === target) {
            return true;
        }
    }
    return false;
}
/**
 * 拦截协调器
 */
export class InstructionCoordinator {
    config;
    customDshHome;
    cachedRenderResult;
    constructor(config, customDshHome) {
        this.config = config;
        this.customDshHome = customDshHome;
    }
    updateConfig(newConfig) {
        this.config = newConfig;
        this.cachedRenderResult = undefined;
    }
    /**
     * 显式使渲染缓存失效，保留当前正在生效的运行时配置
     */
    invalidateCache() {
        this.cachedRenderResult = undefined;
    }
    /**
     * 刷新并获取精细化渲染的提示词
     */
    getRenderedInstructions(workspaceDir) {
        const files = discoverInstructionFiles(workspaceDir, this.config.globalPreference, this.customDshHome);
        // 构建精准指纹，包含目录、文件路径、文件内容摘要以及四层策略参数
        const fileSignatures = files.map((f) => {
            const digest = crypto.createHash('sha1').update(f.content).digest('hex').slice(0, 8);
            return `${f.path}:${f.content.length}:${digest}`;
        }).join('|');
        const configSignature = `pref:${this.config.globalPreference}` +
            `|global:${this.config.globalPolicy.mode}:${this.config.globalPolicy.maxBytes}` +
            `|claude:${this.config.projectClaudePolicy.mode}:${this.config.projectClaudePolicy.maxBytes}` +
            `|agents:${this.config.projectAgentsPolicy.mode}:${this.config.projectAgentsPolicy.maxBytes}` +
            `|sub:${this.config.subdirectoriesPolicy.mode}:${this.config.subdirectoriesPolicy.maxBytes}`;
        const signature = `${workspaceDir}|${fileSignatures}|${configSignature}`;
        if (this.cachedRenderResult && this.cachedRenderResult.signature === signature) {
            return this.cachedRenderResult.result;
        }
        const result = renderGranularInstructionSet(files, this.config);
        this.cachedRenderResult = { signature, result };
        return result;
    }
    /**
     * 洋葱圈拦截处理函数（合体方案：接管全部 agent-instructions 消息）
     *
     * 注册在 pre-step 洋葱最外层（见 src/index.ts `prepend`），`await next()`
     * 之后决策已包含官方注入的全部指令消息（基线 + 增量 delta）。
     * 这里把每一条 `source.kind === 'agent-instructions'` 的 content 替换为
     * 按四层策略渲染后的文本；`source` 原样保留（baseline/baselineIdentity/
     * changes 是官方的状态账本，改动会触发基线重铺）。去重闸保证相同文本
     * 不重复替换，杜绝历史累积导致的 token 膨胀。
     */
    async handlePreStep(payload, next, workingDirectory) {
        // 1. 等待下游与内层插件执行完毕（官方与 defaultFn 都已跑完）
        const decision = await next();
        const workspaceDir = await resolveWorkspaceDir(payload, workingDirectory);
        const rendered = this.getRenderedInstructions(workspaceDir);
        // 指令为空（四层全 disabled 或无文件）：替换为最小提示，不移除消息
        // （移除会让官方判定基线消失并重铺）、不用空 content（部分 provider 拒绝）。
        const replacementText = rendered.fullPromptText
            || '<system-reminder>\nNo workspace instructions are active.\n</system-reminder>';
        const agent = payload.agent;
        const alreadyShown = surfaceAlreadyHas(agent, replacementText);
        // 2. 遍历并替换所有 agent-instructions 消息（基线 + delta 全覆盖）
        let changed = false;
        const newMessages = decision.messages.map((m) => {
            if (m?.source?.kind !== 'agent-instructions')
                return m;
            if (alreadyShown)
                return m; // 去重闸：这份文本已在会话表面，跳过
            changed = true;
            return {
                ...m,
                content: [
                    {
                        type: 'text',
                        text: replacementText
                    }
                ]
                // source 原样保留：不动 baseline / baselineIdentity / changes
            };
        });
        if (!changed)
            return decision;
        return {
            ...decision,
            messages: newMessages
        };
    }
}
//# sourceMappingURL=coordinator.js.map