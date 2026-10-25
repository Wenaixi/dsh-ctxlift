/**
 * DSH Workspace Instructions Granular Truncation Plugin
 * Host Entry Point
 */

import { resolveConfig, type GranularInstructionsConfig } from './config.js';
import { InstructionCoordinator } from './engine/coordinator.js';
import { InstructionsGuardService } from './remote.js';

export const name = 'dsh-ctxlift';

// 声明可选服务依赖
export const inject = {
  optional: ['typertRemote']
};

export function apply(ctx: any, rawConfig?: Partial<GranularInstructionsConfig>) {
  const config = resolveConfig(rawConfig);
  const coordinator = new InstructionCoordinator(config);
  const guardService = new InstructionsGuardService();

  // 1. 注册 Typert Remote RPC 服务通道
  // 若当前环境装载了 typertRemote 网关，则向网关注册服务
  if (ctx.typertRemote) {
    try {
      ctx.typertRemote.register('instructionsGuard', guardService);
    } catch {
      // 容错注册
    }
  }

  // 同时将服务直接绑定在 Context 上供同进程内调用
  ctx.set('instructionsGuard', guardService);

  // 2. 挂载 agent/pre-step 洋葱圈拦截器
  ctx.on('agent/pre-step', async (payload: any, next: () => Promise<any>) => {
    return coordinator.handlePreStep(payload, next);
  });

  // 3. 监听 tools/result 事件：当有文件编辑/写入工具调用完成时，失效缓存
  ctx.on('tools/result', (event: any) => {
    const toolName = event?.tool?.name ?? event?.name;
    if (toolName === 'write' || toolName === 'edit' || toolName === 'ops_replace') {
      coordinator.updateConfig(config);
    }
  });
}
