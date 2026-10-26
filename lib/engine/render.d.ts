/**
 * DSH 工作区指令渲染与 UTF-8 安全截断引擎
 */
import type { FilePolicyConfig, GranularInstructionsConfig } from '../config.js';
export type InstructionFileCategory = 'global' | 'project-claude' | 'project-agents' | 'subdirectory';
export interface InstructionFileItem {
    /** 文件完整路径 */
    path: string;
    /** 展示给大模型的引用标识，如 ~/.dsh/AGENTS.md */
    displayPath: string;
    /** 文件归属分类，用于匹配对应策略 */
    category: InstructionFileCategory;
    /** 文件全文内容 */
    content: string;
}
export interface TruncatedFileResult {
    path: string;
    displayPath: string;
    category: InstructionFileCategory;
    originalBytes: number;
    renderedBytes: number;
    isTruncated: boolean;
    content: string;
}
export interface RenderResult {
    files: TruncatedFileResult[];
    fullPromptText: string;
    totalBytes: number;
}
/**
 * 按 UTF-8 字符边界安全截断，避免切断多字节字符产生乱码
 * 当前固定保留开头、截断尾部；如需头部优先可在此扩展
 */
export declare function truncateUtf8Safe(text: string, maxBytes: number, notice?: string): {
    text: string;
    isTruncated: boolean;
};
/**
 * 按单层策略处理一个指令文件
 */
export declare function processFileWithPolicy(file: InstructionFileItem, policy: FilePolicyConfig): TruncatedFileResult | null;
/**
 * 拼接渲染为 DSH 原生兼容的 system-reminder 结构
 */
export declare function renderGranularInstructionSet(files: InstructionFileItem[], config: GranularInstructionsConfig): RenderResult;
//# sourceMappingURL=render.d.ts.map