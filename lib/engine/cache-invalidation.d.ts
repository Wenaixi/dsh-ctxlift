/**
 * 渲染缓存失效判定：哪些工具执行结果会让 AGENTS.md/CLAUDE.md 的内容可能变化。
 *
 * tools/result 事件的真实签名是 (exec, result)，工具名在 exec.name 上
 * （dsh-tools/lib/types/events.d.ts:48 + contracts.d.ts 的 ToolExecution.name）。
 * 旧实现读 event.tool.name 这类不存在的字段，判断恒为 false，缓存永不失效。
 */
/** 会改动工作区指令文件的工具。取自官方 dsh-tool-fs 注册清单。 */
export declare const FILE_WRITE_TOOLS: ReadonlySet<string>;
/**
 * 判断一次工具执行是否应触发指令渲染缓存失效。
 *
 * @param exec - tools/result 的第一个参数（ToolExecution 快照）
 * @returns 命中写工具时为 true；空输入或未知工具为 false
 */
export declare function shouldInvalidateCache(exec: {
    name?: unknown;
} | undefined | null): boolean;
//# sourceMappingURL=cache-invalidation.d.ts.map