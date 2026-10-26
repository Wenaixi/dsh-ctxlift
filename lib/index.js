/**
 * DSH 工作区指令精细化截断插件（宿主入口）
 *
 * 与官方 agent-instructions 的差异：本插件用"四层策略"精细控制
 * 全局 / 项目 CLAUDE.md / 项目 AGENTS.md / 子目录 四个来源的截断行为，
 * 并在 agent/pre-step 洋葱圈中替换官方注入的指令消息。
 *
 * 装配范式照搬 ponytail：Config Schema 全 volatile、Remote 服务用 ctx.plugin 挂载，
 * 事件一律通过洋葱圈后置步骤注入。
 */
import { Config, resolvePluginConfig } from './config.js';
import { InstructionCoordinator } from './engine/coordinator.js';
import { InstructionsGuardService } from './remote.js';
export const name = 'dsh-ctxlift';
// 插件自己不依赖任何服务，零阻碍立即激活
export const inject = [];
export function apply(ctx, rawConfig) {
    const config = resolvePluginConfig(rawConfig);
    const coordinator = new InstructionCoordinator(config);
    // 1. 挂载 Typert Remote 服务：ctx.plugin(ServiceClass, deps) 第二参即构造参数
    if (typeof ctx.plugin === 'function') {
        ctx.plugin(InstructionsGuardService);
    }
    else {
        ctx.logger?.debug?.('[dsh-ctxlift] ctx.plugin unavailable, remote service skipped');
    }
    // 2. agent/pre-step 洋葱圈：await next() 后替换官方指令消息
    ctx.on('agent/pre-step', async (payload, next) => {
        return coordinator.handlePreStep(payload, next);
    });
    // 3. 监听 volatile 配置热更新：loader 广播被改动的字段路径
    ctx.on('loader/volatile-update', (paths) => {
        const touched = new Set(paths.map((p) => String(p)));
        const keys = ['globalPreference', 'globalPolicy', 'projectClaudePolicy', 'projectAgentsPolicy', 'subdirectoriesPolicy'];
        if (keys.some((k) => touched.has(k))) {
            coordinator.updateConfig(resolvePluginConfig(rawConfig));
        }
    });
    // 4. 监听 tools/result：文件编辑/写入完成后失效渲染缓存
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
    Config,
    apply
};
//# sourceMappingURL=index.js.map