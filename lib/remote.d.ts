/**
 * 全局指令文件读写服务（宿主侧 Typert Remote）
 *
 * 为什么继承 TypertRemoteService：网关按服务上的 typertRemote 绑定自动发现端点，
 * 不需要任何手工 register 调用。类构造即向 Context 注册，随 fiber 卸载而消失。
 */
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Context } from '@deepseek-ai/cordis';
import { type GlobalFileResolution, type SaveGlobalFileResult } from './engine/files.js';
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
export declare class InstructionsGuardService extends TypertRemoteService {
    private readonly customDshHome?;
    constructor(ctx: Context, customDshHome?: string);
    /**
     * 读取全局指令文件元数据与内容
     */
    getGlobalInfo(): Promise<GlobalFileResolution>;
    /**
     * 原子保存全局指令文件
     * 先写临时文件再 rename，杜绝写入中途失败留下半截文件
     */
    saveGlobalContent(payload: SaveGlobalPayload): Promise<SaveGlobalResult>;
    /**
     * 选择要查看/编辑的全局文件名（AGENTS.md <-> CLAUDE.md），并返回该文件的状态与内容。
     * 只读，不落盘：目标文件不存在时 content 为空字符串，由用户在编辑器里写好内容后
     * 调用 saveGlobalContent 自动创建（写入临时文件再 rename，不需要目标预先存在）。
     */
    switchGlobalFilename(payload: SwitchGlobalPayload): Promise<SwitchGlobalResult>;
}
//# sourceMappingURL=remote.d.ts.map