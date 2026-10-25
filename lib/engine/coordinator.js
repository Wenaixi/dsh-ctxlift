/**
 * DSH Workspace Instructions Onion-Skin Step Interceptor Coordinator
 */
import { discoverInstructionFiles } from './files.js';
import { renderGranularInstructionSet } from './render.js';
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
     * 刷新并获取精细化渲染的提示词
     */
    getRenderedInstructions(workspaceDir) {
        const files = discoverInstructionFiles(workspaceDir, this.config.globalPreference, this.customDshHome);
        // 构建轻量指纹，避免重复渲染
        const signature = files.map((f) => `${f.path}:${f.content.length}`).join('|') +
            `|pref:${this.config.globalPreference}` +
            `|global:${this.config.globalPolicy.mode}:${this.config.globalPolicy.maxBytes}` +
            `|claude:${this.config.projectClaudePolicy.mode}:${this.config.projectClaudePolicy.maxBytes}` +
            `|agents:${this.config.projectAgentsPolicy.mode}:${this.config.projectAgentsPolicy.maxBytes}` +
            `|sub:${this.config.subdirectoriesPolicy.mode}:${this.config.subdirectoriesPolicy.maxBytes}`;
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
    async handlePreStep(payload, next) {
        // 1. 等待下游与内层插件执行完毕
        const decision = await next();
        const workspaceDir = payload.agent.cwd ?? process.cwd();
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
            // 原地精准替换官方消息的 content，保留其原有元数据，同时替换为精细控制后的文本
            const targetMsg = decision.messages[officialMsgIndex];
            const updatedMsg = {
                ...targetMsg,
                content: [
                    {
                        type: 'text',
                        text: rendered.fullPromptText
                    }
                ]
            };
            const newMessages = [...decision.messages];
            newMessages[officialMsgIndex] = updatedMsg;
            return {
                ...decision,
                messages: newMessages
            };
        }
        else {
            // 官方插件未启用或已被禁用：由本插件自主构造标准的指令消息并注入
            const syntheticMsg = {
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
                    baseline: true,
                    baselineIdentity: 'granular-instructions-guard'
                }
            };
            // 插入到消息序列中
            const newMessages = [...decision.messages, syntheticMsg];
            return {
                ...decision,
                messages: newMessages
            };
        }
    }
}
//# sourceMappingURL=coordinator.js.map