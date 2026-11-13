/**
 * DSH 工作区指令精细化截断插件（宿主入口）
 *
 * 与官方 agent-instructions 的关系：本插件是它的「精细截断层」。官方负责
 * 基线/增量的投递，本插件注册在 agent/pre-step 洋葱**最外层**（prepend），
 * 在官方注入之后接管全部 `source.kind === 'agent-instructions'` 消息：
 * 把 content 换成按四层策略渲染后的文本，`source` 原样保留（不动官方的
 * baseline/baselineIdentity/changes 状态账本），并用会话表面去重闸保证
 * 相同文本不重复替换，杜绝历史累积导致的 token 膨胀。
 *
 * 装配范式照搬 ponytail：Config Schema 全 volatile、Remote 服务用 ctx.plugin 挂载，
 * 事件一律通过洋葱圈后置步骤注入。
 */
import { Config, resolvePluginConfig } from './config.js';
import { InstructionCoordinator } from './engine/coordinator.js';
import { shouldInvalidateCache } from './engine/cache-invalidation.js';
import { InstructionsGuardService } from './remote.js';
export const name = 'dsh-ctxlift';
// 插件自己不依赖任何服务，零阻碍立即激活
export const inject = [];
export function apply(ctx, rawConfig) {
    const config = resolvePluginConfig(rawConfig);
    const coordinator = new InstructionCoordinator(config);
    // 1. 挂载 Typert Remote 服务：ctx.plugin(ServiceClass, deps) 第二参即构造参数
    if (typeof ctx.plugin === 'function') {
        ctx.plugin(InstructionsGuardService, {
            getPreference: () => resolvePluginConfig(rawConfig).globalPreference
        });
    }
    else {
        ctx.logger?.debug?.('[dsh-ctxlift] ctx.plugin unavailable, remote service skipped');
    }
    // 2. agent/pre-step 洋葱圈（prepend 注册到最外层）：
    //    在官方注入之后接管全部 agent-instructions 消息，替换 content、保留 source。
    //    prepend 是关键：默认 push 会让 ctxlift 落在外层内部，await next() 只跑到
    //    defaultFn，永远看不到官方注入的消息（官方在自己的 next() 之后才插入）。
    //    workingDirectory 服务在 0.2.2-rc.1 才是会话真实目录的权威来源；
    //    用可选访问而非 inject 依赖，保持「零阻碍激活」不变。
    ctx.on('agent/pre-step', async (payload, next) => {
        const workingDirectory = typeof ctx.get === 'function' ? ctx.get('workingDirectory') : undefined;
        return coordinator.handlePreStep(payload, next, workingDirectory);
    }, true);
    // 3. 监听 volatile 配置热更新：loader 广播被改动的字段路径
    ctx.on('loader/volatile-update', (paths) => {
        const touched = new Set(paths.map((p) => String(p)));
        const keys = ['globalPreference', 'globalPolicy', 'projectClaudePolicy', 'projectAgentsPolicy', 'subdirectoriesPolicy'];
        if (keys.some((k) => touched.has(k))) {
            coordinator.updateConfig(resolvePluginConfig(rawConfig));
        }
    });
    // 4. 监听 tools/result：文件编辑/写入完成后失效渲染缓存。
    //    事件真实签名是 (exec, result)（dsh-tools/lib/types/events.d.ts:48），
    //    工具名在 exec.name 上；旧实现把它当单参 event 读 event.tool.name，
    //    该字段不存在，判断恒为 false，导致改完指令文件后缓存永不失效。
    ctx.on('tools/result', (exec) => {
        if (shouldInvalidateCache(exec))
            coordinator.invalidateCache();
    });
}
export default {
    name,
    inject,
    Config,
    apply
};
//# sourceMappingURL=index.js.map