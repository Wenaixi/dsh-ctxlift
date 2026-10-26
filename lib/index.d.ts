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