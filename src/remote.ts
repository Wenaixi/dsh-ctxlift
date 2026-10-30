/**
 * 全局指令文件读写服务（宿主侧 Typert Remote）
 *
 * 为什么继承 TypertRemoteService：网关按服务上的 typertRemote 绑定自动发现端点，
 * 不需要任何手工 register 调用。类构造即向 Context 注册，随 fiber 卸载而消失。
 */

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Context } from '@deepseek-ai/cordis';
import {
  getDshHomeDir,
  resolveGlobalInstructionFile,
  saveGlobalInstructionFile,
  type GlobalFileResolution,
  type SaveGlobalFileResult
} from './engine/files.js';

export interface SaveGlobalPayload {
  filename: 'AGENTS.md' | 'CLAUDE.md';
  content: string;
}

export interface SwitchGlobalPayload {
  target: 'AGENTS.md' | 'CLAUDE.md';
}

export type SaveGlobalResult = SaveGlobalFileResult;

export interface SwitchGlobalResult extends GlobalFileResolution {
  ok: boolean;
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
    if (typeof payload?.content !== 'string') {
      throw new Error('saveGlobalContent requires a string "content" field; refusing to write');
    }
    const dshHome = this.customDshHome ?? getDshHomeDir();
    return saveGlobalInstructionFile(payload.filename, payload.content, dshHome);
  }

  /**
   * 选择要查看/编辑的全局文件名（AGENTS.md <-> CLAUDE.md），并返回该文件的状态与内容。
   * 只读，不落盘：目标文件不存在时 content 为空字符串，由用户在编辑器里写好内容后
   * 调用 saveGlobalContent 自动创建（写入临时文件再 rename，不需要目标预先存在）。
   */
  @Remote('switchGlobalFilename')
  async switchGlobalFilename(payload: SwitchGlobalPayload): Promise<SwitchGlobalResult> {
    if (!payload || (payload.target !== 'AGENTS.md' && payload.target !== 'CLAUDE.md')) {
      throw new Error('switchGlobalFilename requires a "target" of "AGENTS.md" or "CLAUDE.md"');
    }
    const dshHome = this.customDshHome ?? getDshHomeDir();
    const preference =
      payload.target === 'CLAUDE.md' ? 'claude' : 'agents';
    return { ok: true, ...resolveGlobalInstructionFile(preference, dshHome) };
  }
}
