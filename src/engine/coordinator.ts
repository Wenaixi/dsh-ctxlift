/**
 * DSH Workspace Instructions Onion-Skin Step Interceptor Coordinator
 */

import { discoverInstructionFiles } from './files.js';
import { renderGranularInstructionSet, type RenderResult } from './render.js';
import type { GranularInstructionsConfig } from '../config.js';

export interface PreStepEventPayload {
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
   * 刷新并获取精细化渲染的提示词
   */
  getRenderedInstructions(workspaceDir: string): RenderResult {
    const files = discoverInstructionFiles(
      workspaceDir,
      this.config.globalPreference,
      this.customDshHome
    );

    // 构建轻量指纹，避免重复渲染
    const signature = files.map((f) => `${f.path}:${f.content.length}`).join('|') +
      `|pref:${this.config.globalPreference}` +
      `|global:${this.config.globalPolicy.mode}:${this.config.globalPolicy.maxBytes}` +
      `|claude:${this.config.projectClaudePolicy.mode}:${this.config.projectClaudePolicy.maxBytes}` +
      `|agents:${this.config.projectAgentsPolicy.mode}:${this.config.projectAgentsPolicy.maxBytes}` +
      `|sub:${this.config.subdirectoriesPolicy.mode}:${this.config.subdirectoriesPolicy.maxBytes}`;

    if (this.cachedRenderResult && this.cachedRenderResult.signature === signature) {
      return this.cachedRenderResult.result;
    }

    const result = renderGranularInstructionSet(files, this.config);
    this.cachedRenderResult = { signature, result };
    return result;
  }

  /**
   * 洋葱圈拦截处理函数
   */
  async handlePreStep(
    payload: PreStepEventPayload,
    next: () => Promise<DecisionResult>
  ): Promise<DecisionResult> {
    // 1. 等待下游与内层插件执行完毕
    const decision = await next();

    const workspaceDir = payload?.agent?.cwd ?? payload?.cwd ?? payload?.workspaceDir ?? process.cwd();
    const rendered = this.getRenderedInstructions(workspaceDir);

    // 如果所有文件都被禁用或为空，且有官方指令，则将其移除
    if (!rendered.fullPromptText) {
      const filtered = decision.messages.filter((m) => m?.source?.kind !== 'agent-instructions');
      return {
        ...decision,
        messages: filtered
      };
    }

    // 2. 检查 decision.messages 中是否存在官方插件生成的 agent-instructions 消息
    const officialMsgIndex = decision.messages.findIndex(
      (m) => m?.source?.kind === 'agent-instructions'
    );

    if (officialMsgIndex !== -1) {
      // 原地精准替换官方消息的 content，保留其原有元数据，同时兜底保证 changes 严格为数组（杜绝上游 flatMap 崩溃）
      const targetMsg = decision.messages[officialMsgIndex];
      const targetSource = targetMsg?.source ?? {};
      const updatedMsg = {
        ...targetMsg,
        content: [
          {
            type: 'text',
            text: rendered.fullPromptText
          }
        ],
        source: {
          ...targetSource,
          changes: Array.isArray(targetSource.changes) ? targetSource.changes : []
        }
      };

      const newMessages = [...decision.messages];
      newMessages[officialMsgIndex] = updatedMsg;

      return {
        ...decision,
        messages: newMessages
      };
    } else {
      // 官方插件未启用或已被禁用：由本插件自主构造标准的指令消息并注入，必须显式提供 changes: []
      const syntheticMsg = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: rendered.fullPromptText
          }
        ],
        source: {
          kind: 'agent-instructions',
          form: 'instructions',
          baseline: true,
          baselineIdentity: 'granular-instructions-guard',
          changes: []
        }
      };

      // 插入到消息序列中
      const newMessages = [...decision.messages, syntheticMsg];
      return {
        ...decision,
        messages: newMessages
      };
    }
  }
}
