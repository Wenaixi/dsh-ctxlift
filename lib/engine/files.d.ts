/**
 * DSH Workspace Instructions File Discovery and Multi-Mode Global File Manager
 */
import type { InstructionFileItem } from './render.js';
import type { GlobalFilePreference } from '../config.js';
export interface GlobalFileResolution {
    primaryPath: string;
    alternatePath?: string;
    activeFilename: 'AGENTS.md' | 'CLAUDE.md';
    exists: boolean;
    content: string;
    sizeBytes: number;
    lastModifiedMs: number;
}
/**
 * 获取 DSH 全局配置目录 (~/.dsh 或 $DSH_HOME)
 */
export declare function getDshHomeDir(): string;
/**
 * 获取 Agents 全局目录 (~/.agents 或 $AGENTS_HOME)
 */
export declare function getAgentsHomeDir(): string;
/**
 * 解析全局指令文件状态与内容
 */
export declare function resolveGlobalInstructionFile(preference?: GlobalFilePreference, customDshHome?: string): GlobalFileResolution;
/**
 * 寻找工作区或项目根目录（通过向上探测 .git、package.json 等特征文件）
 */
export declare function findProjectRoot(startDir: string): string;
/**
 * 扫描并搜集从全局到项目的所有指令文件列表
 */
export declare function discoverInstructionFiles(workspaceDir: string, preference?: GlobalFilePreference, customDshHome?: string): InstructionFileItem[];
//# sourceMappingURL=files.d.ts.map