/**
 * DSH 工作区指令客户端设置控制器
 * 纯状态机无头控制器，遵循 DSH 官方模式
 */
import type { GranularInstructionsConfig, GlobalFilePreference, TruncateMode } from '../config.js';
import type { GlobalFileResolution } from '../engine/files.js';
export interface FormScopeSnapshot<T = any> {
    value?: T;
    revision?: number;
    writable?: boolean;
}
export interface FormScope<T = any> {
    getSnapshot(): FormScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    mutate(ops: any[], expectedRevision?: number): Promise<boolean>;
}
export interface RemoteClientGateway {
    instructionsGuard?: {
        getGlobalInfo(signal?: AbortSignal): Promise<GlobalFileResolution>;
        saveGlobalContent(payload: {
            filename: 'AGENTS.md' | 'CLAUDE.md';
            content: string;
        }, signal?: AbortSignal): Promise<{
            ok: boolean;
            sizeBytes: number;
        }>;
        switchGlobalFilename(payload: {
            target: 'AGENTS.md' | 'CLAUDE.md';
            copyExisting?: boolean;
        }, signal?: AbortSignal): Promise<{
            ok: boolean;
        }>;
    };
}
export interface ControllerState {
    /** 截断配置状态 */
    config: GranularInstructionsConfig;
    configSaving: boolean;
    configError?: string;
    /** 全局文件编辑器状态 */
    globalFileLoading: boolean;
    globalFileSaving: boolean;
    globalFileError?: string;
    activeFilename: 'AGENTS.md' | 'CLAUDE.md';
    fileOriginalContent: string;
    draftContent: string;
    isDirty: boolean;
    fileSizeBytes: number;
}
export declare class InstructionsSettingsController {
    private scope?;
    private remote?;
    private state;
    private listeners;
    private mutationLock;
    constructor(scope?: FormScope<GranularInstructionsConfig>, remote?: RemoteClientGateway, initialConfig?: GranularInstructionsConfig);
    getState(): ControllerState;
    subscribe(listener: () => void): () => void;
    private notify;
    private syncFromScope;
    /**
     * 原子修改配置字段，遵循操作即写与单次原子 ops 规范
     */
    updateConfigField(path: string[], value: any): Promise<boolean>;
    /**
     * 切换全局文件偏好 (auto / agents / claude / both)
     */
    setGlobalPreference(pref: GlobalFilePreference): Promise<boolean>;
    /**
     * 修改各层截断模式 (unlimited / truncate / disabled)
     */
    setPolicyMode(layer: 'globalPolicy' | 'projectClaudePolicy' | 'projectAgentsPolicy' | 'subdirectoriesPolicy', mode: TruncateMode): Promise<boolean>;
    /**
     * 修改各层截断上限字节数
     */
    setPolicyMaxBytes(layer: 'globalPolicy' | 'projectClaudePolicy' | 'projectAgentsPolicy' | 'subdirectoriesPolicy', maxBytes: number): Promise<boolean>;
    /**
     * 从后端拉取当前全局指令文件内容与元数据
     */
    loadGlobalFile(): Promise<void>;
    /**
     * 用户编辑草稿文本
     */
    setDraftContent(text: string): void;
    /**
     * 保存当前草稿文本至磁盘
     */
    saveGlobalFile(): Promise<boolean>;
    /**
     * 切换全局目标文件名 (AGENTS.md <-> CLAUDE.md)
     */
    switchGlobalFilename(target: 'AGENTS.md' | 'CLAUDE.md'): Promise<boolean>;
}
//# sourceMappingURL=controller.d.ts.map