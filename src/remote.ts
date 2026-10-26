/**
 * 全局指令文件读写服务（宿主侧 Typert Remote）
 *
 * 为什么继承 TypertRemoteService：网关按服务上的 typertRemote 绑定自动发现端点，
 * 不需要任何手工 register 调用。类构造即向 Context 注册，随 fiber 卸载而消失。
 */

import fs from 'node:fs';
import path from 'node:path';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Context } from '@deepseek-ai/cordis';
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
 * 指令守卫宿主服务。
 * 注意：signal 必须声明在业务参数之后（网关按方法签名反射，signal 非末位会直接拒绝）。
 */
export class InstructionsGuardService extends TypertRemoteService {
  private readonly customDshHome?: string;

  constructor(ctx: Context, customDshHome?: string) {
    super(ctx, 'instructionsGuard', { namespace: 'dsh-ctxlift' });
    this.customDshHome = customDshHome;
  }

  /**
   * 读取全局指令文件元数据与内容
   */
  @Remote('getGlobalInfo')
  async getGlobalInfo(): Promise<GlobalFileResolution> {
    const dshHome = this.customDshHome ?? getDshHomeDir();
    return resolveGlobalInstructionFile('auto', dshHome);
  }

  /**
   * 原子保存全局指令文件
   * 先写临时文件再 rename，杜绝写入中途失败留下半截文件
   */
  @Remote('saveGlobalContent')
  async saveGlobalContent(payload: SaveGlobalPayload): Promise<SaveGlobalResult> {
    const filename = payload?.filename === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
    const content = typeof payload?.content === 'string' ? payload.content : '';

    const dshHome = this.customDshHome ?? getDshHomeDir();
    if (!fs.existsSync(dshHome)) {
      fs.mkdirSync(dshHome, { recursive: true });
    }

    const targetPath = path.join(dshHome, filename);
    const tempPath = path.join(
      dshHome,
      `.${filename}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    try {
      fs.writeFileSync(tempPath, content, 'utf-8');
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
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // 临时文件清理失败不影响主流程
        }
      }
      throw new Error(`Failed to save global instruction file: ${(err as Error).message}`);
    }
  }

  /**
   * 切换全局生效的文件名（AGENTS.md <-> CLAUDE.md）。
   * 目标文件不存在时，按 copyExisting 决定是克隆旧内容还是写一个起始标题。
   */
  @Remote('switchGlobalFilename')
  async switchGlobalFilename(payload: SwitchGlobalPayload): Promise<{ ok: boolean; activePath: string }> {
    const targetFilename = payload?.target === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
    const dshHome = this.customDshHome ?? getDshHomeDir();
    if (!fs.existsSync(dshHome)) {
      fs.mkdirSync(dshHome, { recursive: true });
    }

    const targetPath = path.join(dshHome, targetFilename);
    const currentResolution = resolveGlobalInstructionFile('auto', dshHome);

    if (!fs.existsSync(targetPath) && payload?.copyExisting && currentResolution.exists) {
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
