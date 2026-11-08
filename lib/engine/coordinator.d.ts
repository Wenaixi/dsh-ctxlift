/**
 * DSH Workspace Instructions Onion-Skin Step Interceptor Coordinator
 */
import { type RenderResult } from './render.js';
import type { GranularInstructionsConfig } from '../config.js';
export interface PreStepEventPayload {
    /** 0.2.2-rc.1 的 agent/pre-step payload 携带 agent 实体（无 cwd 字段） */
    agent?: {
        cwd?: string;
        workspace?: {
            root?: string;
        };
        inbox?: {
            nextStep?: any[];
        };
    };
    cwd?: string;
    workspaceDir?: string;
    messages: any[];
    step: number;
    signal?: AbortSignal;
}
export interface DecisionResult {
    messages: any[];
    [key: string]: any;
}
/**
 * 会话表面是否已存在相同文本的指令消息（去重闸）。
 *
 * 与官方自己用的账本一致（`agent.session.surface.nodes` + `eventAt`）：
 * 命中说明这份渲染已经进过上下文，不必再次替换，天然杜绝每轮重复追加
 * 导致的 token 膨胀；session 重放后 surface 恢复，跨重启同样有效。
 */
export declare function surfaceAlreadyHas(agent: unknown, text: string): boolean;
/**
 * 拦截协调器
 */
export declare class InstructionCoordinator {
    private config;
    private customDshHome?;
    private cachedRenderResult?;
    constructor(config: GranularInstructionsConfig, customDshHome?: string);
    updateConfig(newConfig: GranularInstructionsConfig): void;
    /**
     * 显式使渲染缓存失效，保留当前正在生效的运行时配置
     */
    invalidateCache(): void;
    /**
     * 刷新并获取精细化渲染的提示词
     */
    getRenderedInstructions(workspaceDir: string): RenderResult;
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
    handlePreStep(payload: PreStepEventPayload, next: () => Promise<DecisionResult>, workingDirectory?: {
        get?: (session: any) => string;
        ensure?: (agent: any, signal?: AbortSignal) => Promise<string>;
    }): Promise<DecisionResult>;
}
//# sourceMappingURL=coordinator.d.ts.map