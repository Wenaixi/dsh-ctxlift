/**
 * DSH Workspace Instructions Client Settings Controller
 * Pure state machine headless controller following DSH official patterns
 */
export class InstructionsSettingsController {
    scope;
    remote;
    state;
    listeners = new Set();
    mutationLock = false;
    constructor(scope, remote, initialConfig) {
        this.scope = scope;
        this.remote = remote;
        const baseConfig = initialConfig ?? {
            globalPreference: 'auto',
            globalPolicy: { mode: 'unlimited', maxBytes: 131072, truncateFrom: 'tail' },
            projectClaudePolicy: { mode: 'truncate', maxBytes: 65536, truncateFrom: 'tail' },
            projectAgentsPolicy: { mode: 'truncate', maxBytes: 65536, truncateFrom: 'tail' },
            subdirectoriesPolicy: { mode: 'truncate', maxBytes: 32768, truncateFrom: 'tail' },
            noticePolicy: 'compact',
            totalMaxBytes: 0
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
    getState() {
        return this.state;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notify() {
        for (const listener of this.listeners) {
            try {
                listener();
            }
            catch { /* ignore */ }
        }
    }
    syncFromScope() {
        if (!this.scope)
            return;
        try {
            const snap = typeof this.scope.getSnapshot === 'function'
                ? this.scope.getSnapshot()
                : { value: typeof this.scope.get === 'function' ? this.scope.get() : undefined };
            if (snap && snap.value && typeof snap.value === 'object') {
                this.state.config = {
                    ...this.state.config,
                    ...snap.value
                };
            }
        }
        catch {
            // 容错防止宿主环境初始化时抛出异常
        }
    }
    /**
     * 原子修改配置字段，严格遵循操作即写与单次原子 ops 规范
     */
    async updateConfigField(path, value) {
        if (!this.scope || this.mutationLock)
            return false;
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
        }
        finally {
            this.mutationLock = false;
            this.state.configSaving = false;
            this.notify();
        }
    }
    /**
     * 切换全局文件偏好 (auto / agents / claude / both)
     */
    async setGlobalPreference(pref) {
        return this.updateConfigField(['globalPreference'], pref);
    }
    /**
     * 修改各层截断模式 (unlimited / truncate / disabled)
     */
    async setPolicyMode(layer, mode) {
        return this.updateConfigField([layer, 'mode'], mode);
    }
    /**
     * 修改各层截断上限字节数
     */
    async setPolicyMaxBytes(layer, maxBytes) {
        return this.updateConfigField([layer, 'maxBytes'], Math.max(128, Math.floor(maxBytes)));
    }
    /**
     * 从后端拉取当前全局指令文件内容与元数据
     */
    async loadGlobalFile() {
        if (!this.remote?.instructionsGuard)
            return;
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
        }
        catch (err) {
            this.state.globalFileError = err.message;
        }
        finally {
            this.state.globalFileLoading = false;
            this.notify();
        }
    }
    /**
     * 用户编辑草稿文本
     */
    setDraftContent(text) {
        this.state.draftContent = text;
        this.state.isDirty = text !== this.state.fileOriginalContent;
        this.notify();
    }
    /**
     * 保存当前草稿文本至磁盘
     */
    async saveGlobalFile() {
        if (!this.remote?.instructionsGuard || this.state.globalFileSaving)
            return false;
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
        }
        catch (err) {
            this.state.globalFileError = err.message;
            return false;
        }
        finally {
            this.state.globalFileSaving = false;
            this.notify();
        }
    }
    /**
     * 切换全局目标文件名 (AGENTS.md <-> CLAUDE.md)
     */
    async switchGlobalFilename(target) {
        if (!this.remote?.instructionsGuard)
            return false;
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
        }
        catch (err) {
            this.state.globalFileError = err.message;
            return false;
        }
        finally {
            this.state.globalFileLoading = false;
            this.notify();
        }
    }
}
//# sourceMappingURL=controller.js.map