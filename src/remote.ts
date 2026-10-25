/**
 * DSH Workspace Instructions Host Remote RPC Service
 * Provides atomic read/write and file switching operations for global instruction files
 */

import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import {
  getDshHomeDir,
  resolveGlobalInstructionFile,
  type GlobalFileResolution
} from './engine/files.js';

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
export class InstructionsGuardService {
  private customDshHome?: string;

  constructor(customDshHome?: string) {
    this.customDshHome = customDshHome;
  }

  /**
   * 读取全局指令文件元数据与内容
   */
  async getGlobalInfo(signal?: AbortSignal): Promise<GlobalFileResolution> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const dshHome = this.customDshHome ?? getDshHomeDir();
    // 默认按照 auto 模式解析
    return resolveGlobalInstructionFile('auto', dshHome);
  }

  /**
   * 原子保存全局指令文件
   * 采用写临时文件后原子 rename 的方式，杜绝文件损坏风险
   */
  async saveGlobalContent(
    payload: SaveGlobalPayload,
    signal?: AbortSignal
  ): Promise<SaveGlobalResult> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const filename = payload.filename === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
    const content = typeof payload.content === 'string' ? payload.content : '';

    const dshHome = this.customDshHome ?? getDshHomeDir();
    if (!fs.existsSync(dshHome)) {
      fs.mkdirSync(dshHome, { recursive: true });
    }

    const targetPath = path.join(dshHome, filename);
    const tempPath = path.join(dshHome, `.${filename}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      // 写入临时文件
      fs.writeFileSync(tempPath, content, 'utf-8');
      // 原子替换
      fs.renameSync(tempPath, targetPath);

      const stats = fs.statSync(targetPath);
      return {
        ok: true,
        path: targetPath,
        sizeBytes: stats.size,
        lastModifiedMs: stats.mtimeMs
      };
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
      }
      throw new Error(`Failed to save global instruction file: ${(err as Error).message}`);
    }
  }

  /**
   * 切换全局生效的文件名 (AGENTS.md <-> CLAUDE.md)
   * 若目标文件不存在且设置了 copyExisting，自动从旧文件克隆内容
   */
  async switchGlobalFilename(
    payload: SwitchGlobalPayload,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; activePath: string }> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const targetFilename = payload.target === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
    const dshHome = this.customDshHome ?? getDshHomeDir();
    if (!fs.existsSync(dshHome)) {
      fs.mkdirSync(dshHome, { recursive: true });
    }

    const targetPath = path.join(dshHome, targetFilename);
    const currentResolution = resolveGlobalInstructionFile('auto', dshHome);

    if (!fs.existsSync(targetPath) && payload.copyExisting && currentResolution.exists) {
      fs.writeFileSync(targetPath, currentResolution.content, 'utf-8');
    } else if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, `# 全局工作守则 (${targetFilename})\n`, 'utf-8');
    }

    return {
      ok: true,
      activePath: targetPath
    };
  }
}
