/**
 * DSH 工作区指令客户端设置控制器
 * 纯状态机无头控制器，遵循 DSH 官方模式
 */

import type {
  GranularInstructionsConfig,
  GlobalFilePreference,
  TruncateMode
} from '../config.js';
import type { GlobalFileResolution } from '../engine/files.js';

export interface FormScopeSnapshot<T = any> {
  value?: T;
  revision?: number;
  writable?: boolean;
}

export interface FormScope<T = any> {
  getSnapshot(): FormScopeSnapshot<T>;
  subscribe(listener: () => void): () => void;
  mutate(ops: any[], expectedRevision?: number): Promise<boolean>;
}

export interface RemoteClientGateway {
  instructionsGuard?: {
    getGlobalInfo(signal?: AbortSignal): Promise<GlobalFileResolution>;
    saveGlobalContent(payload: { filename: 'AGENTS.md' | 'CLAUDE.md'; content: string }, signal?: AbortSignal): Promise<{ ok: boolean; sizeBytes: number }>;
    switchGlobalFilename(payload: { target: 'AGENTS.md' | 'CLAUDE.md'; copyExisting?: boolean }, signal?: AbortSignal): Promise<{ ok: boolean }>;
  };
}

export interface ControllerState {
  /** 截断配置状态 */
  config: GranularInstructionsConfig;
  configSaving: boolean;
  configError?: string;

  /** 全局文件编辑器状态 */
  globalFileLoading: boolean;
  globalFileSaving: boolean;
  globalFileError?: string;
  activeFilename: 'AGENTS.md' | 'CLAUDE.md';
  fileOriginalContent: string;
  draftContent: string;
  isDirty: boolean;
  fileSizeBytes: number;
}

export class InstructionsSettingsController {
  private scope?: FormScope<GranularInstructionsConfig>;
  private remote?: RemoteClientGateway;
  private state: ControllerState;
  private listeners = new Set<() => void>();
  private mutationLock = false;

  constructor(
    scope?: FormScope<GranularInstructionsConfig>,
    remote?: RemoteClientGateway,
    initialConfig?: GranularInstructionsConfig
  ) {
    this.scope = scope;
    this.remote = remote;

    const baseConfig: GranularInstructionsConfig = initialConfig ?? {
      globalPreference: 'auto',
      globalPolicy: { mode: 'unlimited', maxBytes: 131072 },
      projectClaudePolicy: { mode: 'truncate', maxBytes: 65536 },
      projectAgentsPolicy: { mode: 'truncate', maxBytes: 65536 },
      subdirectoriesPolicy: { mode: 'truncate', maxBytes: 32768 }
    };

    this.state = {
      config: baseConfig,
      configSaving: false,
      globalFileLoading: false,
      globalFileSaving: false,
      activeFilename: 'AGENTS.md',
      fileOriginalContent: '',
      draftContent: '',
      isDirty: false,
      fileSizeBytes: 0
    };

    if (this.scope) {
      this.syncFromScope();
      if (typeof this.scope.subscribe === 'function') {
        this.scope.subscribe(() => {
          this.syncFromScope();
          this.notify();
        });
      }
    }
  }

  getState(): ControllerState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ignore */ }
    }
  }

  private syncFromScope(): void {
    if (!this.scope) return;
    try {
      const snap = typeof this.scope.getSnapshot === 'function'
        ? this.scope.getSnapshot()
        : { value: typeof (this.scope as any).get === 'function' ? (this.scope as any).get() : undefined };

      if (snap && snap.value && typeof snap.value === 'object') {
        this.state.config = {
          ...this.state.config,
          ...snap.value
        };
      }
    } catch {
      // 容错防止宿主环境初始化时抛出异常
    }
  }

  /**
   * 原子修改配置字段，遵循操作即写与单次原子 ops 规范
   */
  async updateConfigField(path: string[], value: any): Promise<boolean> {
    if (!this.scope || this.mutationLock) return false;
    this.mutationLock = true;
    this.state.configSaving = true;
    this.notify();

    try {
      const snap = this.scope.getSnapshot();
      const op = {
        type: 'set',
        path,
        value
      };

      const success = await this.scope.mutate([op], snap.revision);
      return success;
    } finally {
      this.mutationLock = false;
      this.state.configSaving = false;
      this.notify();
    }
  }

  /**
   * 切换全局文件偏好 (auto / agents / claude / both)
   */
  async setGlobalPreference(pref: GlobalFilePreference): Promise<boolean> {
    return this.updateConfigField(['globalPreference'], pref);
  }

  /**
   * 修改各层截断模式 (unlimited / truncate / disabled)
   */
  async setPolicyMode(
    layer: 'globalPolicy' | 'projectClaudePolicy' | 'projectAgentsPolicy' | 'subdirectoriesPolicy',
    mode: TruncateMode
  ): Promise<boolean> {
    return this.updateConfigField([layer, 'mode'], mode);
  }

  /**
   * 修改各层截断上限字节数
   */
  async setPolicyMaxBytes(
    layer: 'globalPolicy' | 'projectClaudePolicy' | 'projectAgentsPolicy' | 'subdirectoriesPolicy',
    maxBytes: number
  ): Promise<boolean> {
    return this.updateConfigField([layer, 'maxBytes'], Math.max(128, Math.floor(maxBytes)));
  }

  /**
   * 从后端拉取当前全局指令文件内容与元数据
   */
  async loadGlobalFile(): Promise<void> {
    if (!this.remote?.instructionsGuard) return;
    this.state.globalFileLoading = true;
    this.state.globalFileError = undefined;
    this.notify();

    try {
      const info = await this.remote.instructionsGuard.getGlobalInfo();
      this.state.activeFilename = info.activeFilename;
      this.state.fileOriginalContent = info.content;
      this.state.draftContent = info.content;
      this.state.fileSizeBytes = info.sizeBytes;
      this.state.isDirty = false;
    } catch (err) {
      this.state.globalFileError = (err as Error).message;
    } finally {
      this.state.globalFileLoading = false;
      this.notify();
    }
  }

  /**
   * 用户编辑草稿文本
   */
  setDraftContent(text: string): void {
    this.state.draftContent = text;
    this.state.isDirty = text !== this.state.fileOriginalContent;
    this.notify();
  }

  /**
   * 保存当前草稿文本至磁盘
   */
  async saveGlobalFile(): Promise<boolean> {
    if (!this.remote?.instructionsGuard || this.state.globalFileSaving) return false;
    this.state.globalFileSaving = true;
    this.state.globalFileError = undefined;
    this.notify();

    try {
      const res = await this.remote.instructionsGuard.saveGlobalContent({
        filename: this.state.activeFilename,
        content: this.state.draftContent
      });

      if (res.ok) {
        this.state.fileOriginalContent = this.state.draftContent;
        this.state.fileSizeBytes = res.sizeBytes;
        this.state.isDirty = false;
        return true;
      }
      return false;
    } catch (err) {
      this.state.globalFileError = (err as Error).message;
      return false;
    } finally {
      this.state.globalFileSaving = false;
      this.notify();
    }
  }

  /**
   * 切换全局目标文件名 (AGENTS.md <-> CLAUDE.md)
   */
  async switchGlobalFilename(target: 'AGENTS.md' | 'CLAUDE.md'): Promise<boolean> {
    if (!this.remote?.instructionsGuard) return false;
    this.state.globalFileLoading = true;
    this.notify();

    try {
      const res = await this.remote.instructionsGuard.switchGlobalFilename({
        target,
        copyExisting: true
      });

      if (res.ok) {
        await this.loadGlobalFile();
        return true;
      }
      return false;
    } catch (err) {
      this.state.globalFileError = (err as Error).message;
      return false;
    } finally {
      this.state.globalFileLoading = false;
      this.notify();
    }
  }
}
