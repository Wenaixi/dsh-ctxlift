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
import type { Config as ConfigShape } from './config.js';
export declare const name = "dsh-ctxlift";
export declare const inject: never[];
export declare function apply(ctx: any, rawConfig?: ConfigShape): void;
declare const _default: {
    name: string;
    inject: never[];
    Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        globalPreference: import("@deepseek-ai/schemastery").default<"agents" | "auto" | "both" | "claude", "agents" | "auto" | "both" | "claude", "volatile">;
        globalPolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
        projectClaudePolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
        projectAgentsPolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
        subdirectoriesPolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
    }>>, Schemastery.ObjectT<NoInfer<{
        globalPreference: import("@deepseek-ai/schemastery").default<"agents" | "auto" | "both" | "claude", "agents" | "auto" | "both" | "claude", "volatile">;
        globalPolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
        projectClaudePolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
        projectAgentsPolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
        subdirectoriesPolicy: import("@deepseek-ai/schemastery").default<NoInfer<Schemastery.ObjectS<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
            mode: import("@deepseek-ai/schemastery").default<"disabled" | "truncate" | "unlimited", "disabled" | "truncate" | "unlimited", "plain">;
            maxBytes: import("@deepseek-ai/schemastery").default<number, number, "plain">;
        }>>>, "volatile">;
    }>>, "plain">;
    apply: typeof apply;
};
export default _default;
//# sourceMappingURL=index.d.ts.map