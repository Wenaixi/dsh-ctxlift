/**
 * 全局指令文件读写服务（宿主侧 Typert Remote）
 *
 * 为什么继承 TypertRemoteService：网关按服务上的 typertRemote 绑定自动发现端点，
 * 不需要任何手工 register 调用。类构造即向 Context 注册，随 fiber 卸载而消失。
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import fs from 'node:fs';
import path from 'node:path';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { getDshHomeDir, resolveGlobalInstructionFile } from './engine/files.js';
/**
 * 指令守卫宿主服务。
 * 注意：signal 必须声明在业务参数之后（网关按方法签名反射，signal 非末位会直接拒绝）。
 */
let InstructionsGuardService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _getGlobalInfo_decorators;
    let _saveGlobalContent_decorators;
    let _switchGlobalFilename_decorators;
    return class InstructionsGuardService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _getGlobalInfo_decorators = [Remote('getGlobalInfo')];
            _saveGlobalContent_decorators = [Remote('saveGlobalContent')];
            _switchGlobalFilename_decorators = [Remote('switchGlobalFilename')];
            __esDecorate(this, null, _getGlobalInfo_decorators, { kind: "method", name: "getGlobalInfo", static: false, private: false, access: { has: obj => "getGlobalInfo" in obj, get: obj => obj.getGlobalInfo }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveGlobalContent_decorators, { kind: "method", name: "saveGlobalContent", static: false, private: false, access: { has: obj => "saveGlobalContent" in obj, get: obj => obj.saveGlobalContent }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _switchGlobalFilename_decorators, { kind: "method", name: "switchGlobalFilename", static: false, private: false, access: { has: obj => "switchGlobalFilename" in obj, get: obj => obj.switchGlobalFilename }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        customDshHome = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, customDshHome) {
            super(ctx, 'instructionsGuard', { namespace: 'dsh-ctxlift' });
            this.customDshHome = customDshHome;
        }
        /**
         * 读取全局指令文件元数据与内容
         */
        async getGlobalInfo() {
            const dshHome = this.customDshHome ?? getDshHomeDir();
            return resolveGlobalInstructionFile('auto', dshHome);
        }
        /**
         * 原子保存全局指令文件
         * 先写临时文件再 rename，杜绝写入中途失败留下半截文件
         */
        async saveGlobalContent(payload) {
            const filename = payload?.filename === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
            const content = typeof payload?.content === 'string' ? payload.content : '';
            const dshHome = this.customDshHome ?? getDshHomeDir();
            if (!fs.existsSync(dshHome)) {
                fs.mkdirSync(dshHome, { recursive: true });
            }
            const targetPath = path.join(dshHome, filename);
            const tempPath = path.join(dshHome, `.${filename}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
            }
            catch (err) {
                if (fs.existsSync(tempPath)) {
                    try {
                        fs.unlinkSync(tempPath);
                    }
                    catch {
                        // 临时文件清理失败不影响主流程
                    }
                }
                throw new Error(`Failed to save global instruction file: ${err.message}`);
            }
        }
        /**
         * 切换全局生效的文件名（AGENTS.md <-> CLAUDE.md）。
         * 目标文件不存在时，按 copyExisting 决定是克隆旧内容还是写一个起始标题。
         */
        async switchGlobalFilename(payload) {
            const targetFilename = payload?.target === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
            const dshHome = this.customDshHome ?? getDshHomeDir();
            if (!fs.existsSync(dshHome)) {
                fs.mkdirSync(dshHome, { recursive: true });
            }
            const targetPath = path.join(dshHome, targetFilename);
            const currentResolution = resolveGlobalInstructionFile('auto', dshHome);
            if (!fs.existsSync(targetPath) && payload?.copyExisting && currentResolution.exists) {
                fs.writeFileSync(targetPath, currentResolution.content, 'utf-8');
            }
            else if (!fs.existsSync(targetPath)) {
                fs.writeFileSync(targetPath, `# 全局工作守则 (${targetFilename})\n`, 'utf-8');
            }
            return {
                ok: true,
                activePath: targetPath
            };
        }
    };
})();
export { InstructionsGuardService };
//# sourceMappingURL=remote.js.map