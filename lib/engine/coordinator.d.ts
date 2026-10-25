/**
 * DSH Workspace Instructions Onion-Skin Step Interceptor Coordinator
 */
import { type RenderResult } from './render.js';
import type { GranularInstructionsConfig } from '../config.js';
export interface PreStepEventPayload {
    agent: {
        cwd?: string;
        workspace?: {
            root?: string;
        };
        inbox?: {
            nextStep?: any[];
        };
    };
    messages: any[];
    step: number;
    signal?: AbortSignal;
}
export interface DecisionResult {
    messages: any[];
    [key: string]: any;
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
     * 刷新并获取精细化渲染的提示词
     */
    getRenderedInstructions(workspaceDir: string): RenderResult;
    /**
     * 洋葱圈拦截处理函数
     */
    handlePreStep(payload: PreStepEventPayload, next: () => Promise<DecisionResult>): Promise<DecisionResult>;
}
//# sourceMappingURL=coordinator.d.ts.map