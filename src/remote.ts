/**
 * 全局指令文件读写服务（宿主侧 Typert Remote）
 *
 * 为什么继承 TypertRemoteService：网关按服务上的 typertRemote 绑定自动发现端点，
 * 不需要任何手工 register 调用。类构造即向 Context 注册，随 fiber 卸载而消失。
 */

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Context } from '@deepseek-ai/cordis';
import type { GlobalFilePreference } from './config.js';
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
 * 服务构造选项。
 *
 * 之所以用对象而非位置参数：cordis 的 `ctx.plugin(Service, config)` 只会
 * 把 `config` 交给构造函数的第二个参数，第三参恒为 `undefined`。
 */
export interface InstructionsGuardOptions {
  /** 自定义 DSH 用户目录；缺省时回落到 `$DSH_HOME` 或 `~/.dsh`。 */
  customDshHome?: string;
  /** 全局文件偏好读取器；必须在每次调用时现读，以跟随宿主的配置热更新。 */
  getPreference?: () => GlobalFilePreference;
}

/**
 * 指令守卫宿主服务。
 * 注意：signal 必须声明在业务参数之后（网关按方法签名反射，signal 非末位会直接拒绝）。
 */
export class InstructionsGuardService extends TypertRemoteService {
  private readonly customDshHome?: string;
  /** 全局文件偏好；由 apply 传入，供编辑器侧解析与引擎实际加载保持一致。 */
  private readonly getPreference: () => GlobalFilePreference;

  constructor(
    ctx: Context,
    options?: InstructionsGuardOptions | string,
    getPreference?: () => GlobalFilePreference
  ) {
    super(ctx, 'instructionsGuard', { namespace: 'dsh-ctxlift' });
    // ctx.plugin(Service, config) 只把 config 交给构造函数的第二个参数，
    // 第三参恒为 undefined。因此这里同时接受 options 对象与旧的字符串传法，
    // 否则 getPreference 会静默退化成 'auto'，编辑器显示的文件与引擎实际
    // 加载的不一致（偏好 claude 且两份都在时，auto 会选 AGENTS.md）。
    const opts: InstructionsGuardOptions =
      typeof options === 'string' ? { customDshHome: options, getPreference } : (options ?? {});
    this.customDshHome = opts.customDshHome;
    this.getPreference = opts.getPreference ?? getPreference ?? (() => 'auto');
  }

  /**
   * 读取全局指令文件元数据与内容
   */
  @Remote('getGlobalInfo')
  async getGlobalInfo(): Promise<GlobalFileResolution> {
    const dshHome = this.customDshHome ?? getDshHomeDir();
    // 必须使用用户的 globalPreference：硬编码 'auto' 会让编辑器显示的文件
    // 与引擎实际加载的不一致（偏好 claude 但两份都在时，auto 选 AGENTS.md）
    return resolveGlobalInstructionFile(this.getPreference(), dshHome);
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
