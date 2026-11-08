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
     * 洋葱圈拦截处理函数
     */
    async handlePreStep(payload, next, workingDirectory) {
        // 1. 等待下游与内层插件执行完毕
        const decision = await next();
        const workspaceDir = await resolveWorkspaceDir(payload, workingDirectory);
        const rendered = this.getRenderedInstructions(workspaceDir);
        // 如果所有文件都被禁用或为空，且有官方指令，则将其移除
        if (!rendered.fullPromptText) {
            const filtered = decision.messages.filter((m) => m?.source?.kind !== 'agent-instructions');
            return {
                ...decision,
                messages: filtered
            };
        }
        // 2. 检查 decision.messages 中是否存在官方插件生成的 agent-instructions 消息
        const officialMsgIndex = decision.messages.findIndex((m) => m?.source?.kind === 'agent-instructions');
        if (officialMsgIndex !== -1) {
            // 原地精准替换官方消息的 content，保留其原有元数据，同时兜底保证 changes 严格为数组（杜绝上游 flatMap 崩溃）
            const targetMsg = decision.messages[officialMsgIndex];
            const targetSource = targetMsg?.source ?? {};
            const updatedMsg = {
                ...targetMsg,
                content: [
                    {
                        type: 'text',
                        text: rendered.fullPromptText
                    }
                ],
                source: {
                    ...targetSource,
                    changes: Array.isArray(targetSource.changes) ? targetSource.changes : []
                }
            };
            const newMessages = [...decision.messages];
            newMessages[officialMsgIndex] = updatedMsg;
            return {
                ...decision,
                messages: newMessages
            };
        }
        else {
            // 官方注入器本轮尚未把指令 claim 进 messages（其流程是先投 inbox、再由
            // agent-loop claim）。此时不能合成 `baseline: true` 的消息：官方按
            // baselineIdentity 判定基线有效性，合成消息会被判为过期基线并与官方
            // 竞争同一槽位，表现为指令重复或反复横跳。
            //
            // 正确做法是沿用官方同款通道：把渲染结果投进 agent.inbox.nextStep，
            // 不设 baseline / baselineIdentity，让官方下一轮 reconcile 时作为增量处理。
            const inbox = payload?.agent?.inbox;
            if (inbox === undefined) {
                // 既无官方消息也无 inbox 通道：保持原决策，不制造竞争消息。
                return decision;
            }
            const injected = {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: rendered.fullPromptText
                    }
                ],
                source: {
                    kind: 'agent-instructions',
                    form: 'instructions',
                    changes: []
                }
            };
            // 同一会话内已有待投递的指令消息时先移除，避免每步累积多份。
            for (const pending of inbox.nextStep ?? []) {
                if (pending?.source?.kind === 'agent-instructions' && pending.id) {
                    inbox.remove?.(pending.id);
                }
            }
            inbox.prepend?.('next-step', injected);
            return decision;
        }
    }
}
//# sourceMappingURL=coordinator.js.map