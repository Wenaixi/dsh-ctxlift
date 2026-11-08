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
/** agent.inbox 的 minimal 结构（0.2.2-rc.1 官方 Inbox 接口子集）。 */
export interface InboxLike {
    readonly nextStep?: ReadonlyArray<{
        id?: string;
        source?: {
            kind?: string;
        };
    }>;
    remove?(messageId: string): boolean;
    prepend?(target: 'next-step' | 'next-turn', message: unknown): void;
}
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
     * 洋葱圈拦截处理函数
     */
    handlePreStep(payload: PreStepEventPayload, next: () => Promise<DecisionResult>, workingDirectory?: {
        get?: (session: any) => string;
        ensure?: (agent: any, signal?: AbortSignal) => Promise<string>;
    }): Promise<DecisionResult>;
}
//# sourceMappingURL=coordinator.d.ts.map