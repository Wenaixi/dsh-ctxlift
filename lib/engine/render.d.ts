/**
 * DSH Workspace Instructions Granular Render and Truncation Engine
 */
import type { FilePolicyConfig, GranularInstructionsConfig, TruncateDirection } from '../config.js';
export type InstructionFileCategory = 'global' | 'project-claude' | 'project-agents' | 'subdirectory';
export interface InstructionFileItem {
    /** 文件完整路径或标准路径标识（如 ~/.dsh/AGENTS.md, /repo/CLAUDE.md） */
    path: string;
    /** 用于展示给大模型的引用标识（如 ~/.dsh/AGENTS.md, CLAUDE.md） */
    displayPath: string;
    /** 文件归属分类，用于匹配独立策略 */
    category: InstructionFileCategory;
    /** 文本全文内容 */
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
 * UTF-8 字符边界安全的字节截断函数
 * 支持从尾部截断 (tail, 保留头部) 或从头部截断 (head, 保留尾部)
 */
export declare function truncateUtf8Safe(text: string, maxBytes: number, direction?: TruncateDirection, notice?: string): {
    text: string;
    isTruncated: boolean;
};
/**
 * 根据独立文件规则处理单个文件
 */
export declare function processFileWithPolicy(file: InstructionFileItem, policy: FilePolicyConfig, noticePolicy: 'compact' | 'silent'): TruncatedFileResult | null;
/**
 * 格式化输出为 DSH 原生兼容的 <system-reminder> 结构
 */
export declare function renderGranularInstructionSet(files: InstructionFileItem[], config: GranularInstructionsConfig): RenderResult;
//# sourceMappingURL=render.d.ts.map