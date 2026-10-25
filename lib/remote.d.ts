/**
 * DSH Workspace Instructions Host Remote RPC Service
 * Provides atomic read/write and file switching operations for global instruction files
 */
import { type GlobalFileResolution } from './engine/files.js';
export interface SaveGlobalPayload {
    filename: 'AGENTS.md' | 'CLAUDE.md';
    content: string;
}
export interface SwitchGlobalPayload {
    target: 'AGENTS.md' | 'CLAUDE.md';
    copyExisting?: boolean;
}
export interface SaveGlobalResult {
    ok: boolean;
    path: string;
    sizeBytes: number;
    lastModifiedMs: number;
}
/**
 * 指令守卫 Host 端核心服务
 */
export declare class InstructionsGuardService {
    private customDshHome?;
    constructor(customDshHome?: string);
    /**
     * 读取全局指令文件元数据与内容
     */
    getGlobalInfo(signal?: AbortSignal): Promise<GlobalFileResolution>;
    /**
     * 原子保存全局指令文件
     * 采用写临时文件后原子 rename 的方式，杜绝文件损坏风险
     */
    saveGlobalContent(payload: SaveGlobalPayload, signal?: AbortSignal): Promise<SaveGlobalResult>;
    /**
     * 切换全局生效的文件名 (AGENTS.md <-> CLAUDE.md)
     * 若目标文件不存在且设置了 copyExisting，自动从旧文件克隆内容
     */
    switchGlobalFilename(payload: SwitchGlobalPayload, signal?: AbortSignal): Promise<{
        ok: boolean;
        activePath: string;
    }>;
}
//# sourceMappingURL=remote.d.ts.map