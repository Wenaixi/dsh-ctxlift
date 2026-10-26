/**
 * DSH Workspace Instructions Granular Truncation Plugin
 * Host Entry Point
 */
import { resolveConfig } from './config.js';
import { InstructionCoordinator } from './engine/coordinator.js';
import { InstructionsGuardService } from './remote.js';
export const name = 'dsh-ctxlift';
// 零阻碍立即激活依赖声明
export const inject = [];
export function apply(ctx, rawConfig) {
    const config = resolveConfig(rawConfig);
    const coordinator = new InstructionCoordinator(config);
    const guardService = new InstructionsGuardService();
    // 1. 注册 Typert Remote RPC 服务通道（使用安全 get 避免触碰未声明属性代理拦截）
    try {
        const typertRemote = typeof ctx.get === 'function' ? ctx.get('typertRemote') : undefined;
        if (typertRemote?.register) {
            typertRemote.register('instructionsGuard', guardService);
        }
    }
    catch {
        // 容错处理
    }
    // 同时将服务直接绑定在 Context 上供同进程内调用
    try {
        if (typeof ctx.provide === 'function') {
            ctx.provide('instructionsGuard');
            ctx.instructionsGuard = guardService;
        }
        else if (typeof ctx.set === 'function') {
            ctx.set('instructionsGuard', guardService);
        }
    }
    catch {
        // 容错处理
    }
    // 2. 挂载 agent/pre-step 洋葱圈拦截器
    ctx.on('agent/pre-step', async (payload, next) => {
        return coordinator.handlePreStep(payload, next);
    });
    // 3. 监听 tools/result 事件：当有文件编辑/写入工具调用完成时，失效缓存
    ctx.on('tools/result', (event) => {
        const toolName = event?.tool?.name ?? event?.name;
        if (toolName === 'write' || toolName === 'edit' || toolName === 'ops_replace') {
            coordinator.updateConfig(config);
        }
    });
}
export default {
    name,
    inject,
    apply
};
//# sourceMappingURL=index.js.map