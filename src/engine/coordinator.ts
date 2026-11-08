/**
 * DSH Workspace Instructions Onion-Skin Step Interceptor Coordinator
 */

import crypto from 'node:crypto';
import { discoverInstructionFiles } from './files.js';
import { renderGranularInstructionSet, type RenderResult } from './render.js';
import type { GranularInstructionsConfig } from '../config.js';

export interface PreStepEventPayload {
  /** 0.2.2-rc.1 的 agent/pre-step payload 携带 agent 实体（无 cwd 字段） */
  agent?: {
    cwd?: string;
    workspace?: { root?: string };
    inbox?: { nextStep?: any[] };
  };
  cwd?: string;
  workspaceDir?: string;
  messages: any[];
  step: number;
  signal?: AbortSignal;
}

export interface DecisionResult {
  messages: any[];
  [key: string]: any;
}

/**
 * 解析当前步的工作目录。
 *
 * 0.2.2-rc.1 起 `agent/pre-step` 的 payload 不再提供 `agent.cwd`（`Agent`
 * 公开面只有 id，增强面也无 cwd），所以优先通过宿主 workingDirectory 服务
 * 取会话真实目录；服务缺失或调用失败时回退 payload 与 process.cwd()。
 */
async function resolveWorkspaceDir(
  payload: PreStepEventPayload,
  workingDirectory: {
    get?: (session: any) => string;
    ensure?: (agent: any, signal?: AbortSignal) => Promise<string>;
  } | undefined
): Promise<string> {
  const agent = payload?.agent;
  if (workingDirectory !== undefined && agent !== undefined) {
    try {
      if (typeof workingDirectory.ensure === 'function') {
        const ensured = await workingDirectory.ensure(agent, payload?.signal);
        if (typeof ensured === 'string' && ensured.length > 0) return ensured;
      }
      const session = (agent as { session?: any }).session;
      if (typeof workingDirectory.get === 'function' && session !== undefined) {
        const current = workingDirectory.get(session);
        if (typeof current === 'string' && current.length > 0) return current;
      }
    } catch {
      // 服务调用失败时静默回退，避免阻断 pre-step 主流程
    }
  }

  const legacy =
    payload?.agent?.cwd ?? payload?.cwd ?? payload?.workspaceDir;
  return typeof legacy === 'string' && legacy.length > 0 ? legacy : process.cwd();
}

/**
 * 会话表面是否已存在相同文本的指令消息（去重闸）。
 *
 * 与官方自己用的账本一致（`agent.session.surface.nodes` + `eventAt`）：
 * 命中说明这份渲染已经进过上下文，不必再次替换，天然杜绝每轮重复追加
 * 导致的 token 膨胀；session 重放后 surface 恢复，跨重启同样有效。
 */
export function surfaceAlreadyHas(agent: unknown, text: string): boolean {
  if (agent === undefined || agent === null) return false;

  const session = (agent as { session?: any }).session;
  const surface = session?.surface;
  const eventAt = session?.eventAt;
  if (surface?.nodes === undefined || typeof eventAt !== 'function') return false;

  const target = crypto.createHash('sha1').update(text).digest('hex');

  for (const seq of surface.nodes as readonly unknown[]) {
    let event: any;
    try {
      event = eventAt(seq);
    } catch {
      continue;
    }
    if (event?.type !== 'user/message') continue;
    if (event.data?.source?.kind !== 'agent-instructions') continue;
    const contentText = event.data?.content
      ?.find?.((c: any) => c?.type === 'text')?.text;
    if (typeof contentText === 'string' && contentText.length > 0 &&
        crypto.createHash('sha1').update(contentText).digest('hex') === target) {
      return true;
    }
  }
  return false;
}

/**
 * 拦截协调器
 */
export class InstructionCoordinator {
  private config: GranularInstructionsConfig;
  private customDshHome?: string;
  private cachedRenderResult?: {
    signature: string;
    result: RenderResult;
  };

  constructor(config: GranularInstructionsConfig, customDshHome?: string) {
    this.config = config;
    this.customDshHome = customDshHome;
  }

  updateConfig(newConfig: GranularInstructionsConfig): void {
    this.config = newConfig;
    this.cachedRenderResult = undefined;
  }

  /**
   * 显式使渲染缓存失效，保留当前正在生效的运行时配置
   */
  invalidateCache(): void {
    this.cachedRenderResult = undefined;
  }

  /**
   * 刷新并获取精细化渲染的提示词
   */
  getRenderedInstructions(workspaceDir: string): RenderResult {
    const files = discoverInstructionFiles(
      workspaceDir,
      this.config.globalPreference,
      this.customDshHome
    );

    // 构建精准指纹，包含目录、文件路径、文件内容摘要以及四层策略参数
    const fileSignatures = files.map((f) => {
      const digest = crypto.createHash('sha1').update(f.content).digest('hex').slice(0, 8);
      return `${f.path}:${f.content.length}:${digest}`;
    }).join('|');

    const configSignature = `pref:${this.config.globalPreference}` +
      `|global:${this.config.globalPolicy.mode}:${this.config.globalPolicy.maxBytes}` +
      `|claude:${this.config.projectClaudePolicy.mode}:${this.config.projectClaudePolicy.maxBytes}` +
      `|agents:${this.config.projectAgentsPolicy.mode}:${this.config.projectAgentsPolicy.maxBytes}` +
      `|sub:${this.config.subdirectoriesPolicy.mode}:${this.config.subdirectoriesPolicy.maxBytes}`;

    const signature = `${workspaceDir}|${fileSignatures}|${configSignature}`;

    if (this.cachedRenderResult && this.cachedRenderResult.signature === signature) {
      return this.cachedRenderResult.result;
    }

    const result = renderGranularInstructionSet(files, this.config);
    this.cachedRenderResult = { signature, result };
    return result;
  }

  /**
   * 洋葱圈拦截处理函数（合体方案：接管全部 agent-instructions 消息）
   *
   * 注册在 pre-step 洋葱最外层（见 src/index.ts `prepend`），`await next()`
   * 之后决策已包含官方注入的全部指令消息（基线 + 增量 delta）。
   * 这里把每一条 `source.kind === 'agent-instructions'` 的 content 替换为
   * 按四层策略渲染后的文本；`source` 原样保留（baseline/baselineIdentity/
   * changes 是官方的状态账本，改动会触发基线重铺）。去重闸保证相同文本
   * 不重复替换，杜绝历史累积导致的 token 膨胀。
   */
  async handlePreStep(
    payload: PreStepEventPayload,
    next: () => Promise<DecisionResult>,
    workingDirectory?: {
      get?: (session: any) => string;
      ensure?: (agent: any, signal?: AbortSignal) => Promise<string>;
    }
  ): Promise<DecisionResult> {
    // 1. 等待下游与内层插件执行完毕（官方与 defaultFn 都已跑完）
    const decision = await next();

    // 决策被 reject 时没有 messages 字段（对齐官方 PreStepDecision 类型：
    // `{kind:'enter', messages} | {kind:'reject'}`）。官方 agent-instructions
    // 在 lib/index.js:1486-1488 专门守卫该分支，这里必须同样守卫，否则
    // decision.messages.map 对 undefined 抛 TypeError 让驱动崩溃。
    if (decision?.kind === 'reject' || !Array.isArray(decision.messages)) {
      return decision;
    }

    const workspaceDir = await resolveWorkspaceDir(payload, workingDirectory);
    const rendered = this.getRenderedInstructions(workspaceDir);

    // 指令为空（四层全 disabled 或无文件）：替换为最小提示，不移除消息
    // （移除会让官方判定基线消失并重铺）、不用空 content（部分 provider 拒绝）。
    const replacementText = rendered.fullPromptText
      || '<system-reminder>\nNo workspace instructions are active.\n</system-reminder>';

    const agent = (payload as { agent?: unknown }).agent;

    // 2. 逐条遍历替换 agent-instructions 消息（基线 + delta 全覆盖）
    //    去重闸按「本条消息」独立判定，而非整轮一次判定：
    //    - 消息 content 已是 replacementText（已替换过/内容相同）→ 跳过，幂等
    //    - 消息 content 是官方原文（增量 delta / 未替换基线）→ 替换为截断文本
    //    这样增量消息不会被「表面已有同文本」误伤而绕过四层截断。
    let changed = false;
    const newMessages = decision.messages.map((m: any) => {
      if (m?.source?.kind !== 'agent-instructions') return m;
      const currentText = m?.content?.[0]?.type === 'text'
        ? m.content[0].text
        : undefined;
      if (currentText === replacementText) return m;   // 已替换过 → 幂等跳过
      if (surfaceAlreadyHas(agent, currentText ?? '')) return m; // 官方原文已在表面 → 跳过
      changed = true;
      return {
        ...m,
        content: [
          {
            type: 'text',
            text: replacementText
          }
        ]
        // source 原样保留：不动 baseline / baselineIdentity / changes
      };
    });

    if (!changed) return decision;
    return {
      ...decision,
      messages: newMessages
    };
  }
}
