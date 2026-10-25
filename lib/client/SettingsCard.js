import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * DSH Workspace Instructions Settings Main View
 * Displays granular truncation controls and embedded global instruction editor
 */
import { useSyncExternalStore } from 'react';
import { EditorPanel } from './EditorPanel.js';
export function SettingsCard({ controller }) {
    const state = useSyncExternalStore((onStoreChange) => controller.subscribe(onStoreChange), () => controller.getState());
    const { config } = state;
    const renderPolicyRow = (label, description, layer) => {
        const policy = config[layer];
        return (_jsx("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
                border: '1px solid var(--dsw-alias-border-subtle, #e4e4e7)'
            }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, fontSize: '13px' }, children: label }), _jsx("div", { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }, children: description })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsxs("select", { value: policy.mode, onChange: (e) => controller.setPolicyMode(layer, e.target.value), style: {
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                                    backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
                                    color: 'inherit'
                                }, children: [_jsx("option", { value: "unlimited", children: "\u4E0D\u622A\u65AD (\u5B8C\u6574\u4FDD\u7559)" }), _jsx("option", { value: "truncate", children: "\u622A\u65AD (\u6309\u5B57\u8282\u4E0A\u9650)" }), _jsx("option", { value: "disabled", children: "\u7981\u7528 (\u4E0D\u6CE8\u5165)" })] }), policy.mode === 'truncate' && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx("input", { type: "number", min: 256, step: 1024, value: policy.maxBytes ?? 65536, onChange: (e) => controller.setPolicyMaxBytes(layer, Number(e.target.value)), style: {
                                            width: '90px',
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            borderRadius: '4px',
                                            border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                                            textAlign: 'right'
                                        } }), _jsx("span", { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }, children: "\u5B57\u8282" })] }))] })] }) }));
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '880px', margin: '0 auto' }, children: [_jsxs("div", { children: [_jsx("h3", { style: { margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }, children: "\u5DE5\u4F5C\u533A\u6307\u4EE4\u7CBE\u7EC6\u5316\u622A\u65AD\u4E0E\u5168\u5C40\u7BA1\u7406" }), _jsx("p", { style: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-text-secondary, #71717a)' }, children: "\u72EC\u7ACB\u7CBE\u7EC6\u63A7\u5236\u5168\u5C40\u6307\u4EE4\u3001\u9879\u76EE\u6839\u76EE\u5F55 CLAUDE.md \u4E0E AGENTS.md \u7684\u622A\u65AD\u7B56\u7565\uFF0C\u675C\u7EDD\u539F\u751F\u4E00\u5200\u5207\u4E22\u5F03\uFF0C\u5E76\u652F\u6301\u5728 Web \u7AEF\u76F4\u63A5\u67E5\u770B\u4E0E\u7F16\u8F91\u5168\u5C40\u5B88\u5219\u3002" })] }), _jsx("div", { style: {
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
                    border: '1px solid var(--dsw-alias-border-subtle, #e4e4e7)'
                }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, fontSize: '13px' }, children: "\u5168\u5C40\u6307\u4EE4\u6587\u4EF6\u504F\u597D" }), _jsx("div", { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }, children: "\u6253\u7834\u5B98\u65B9\u786C\u7F16\u7801\u9650\u5236\uFF0C\u652F\u6301\u5168\u5C40\u4F7F\u7528 CLAUDE.md \u6216\u4E24\u8005\u5408\u5E76\u6CE8\u5165" })] }), _jsxs("select", { value: config.globalPreference, onChange: (e) => controller.setGlobalPreference(e.target.value), style: {
                                padding: '4px 8px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                                backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
                                color: 'inherit'
                            }, children: [_jsx("option", { value: "auto", children: "\u81EA\u52A8\u63A2\u6D4B (\u5B58\u5728\u4F18\u5148)" }), _jsx("option", { value: "claude", children: "\u5168\u5C40\u4EC5\u4F7F\u7528 CLAUDE.md" }), _jsx("option", { value: "agents", children: "\u5168\u5C40\u4EC5\u4F7F\u7528 AGENTS.md" }), _jsx("option", { value: "both", children: "\u4E24\u8005\u540C\u65F6\u8F7D\u5165 (AGENTS + CLAUDE)" })] })] }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: [renderPolicyRow('全局指令 (Global)', '生效于所有会话与项目的全局工作守则（~/.dsh/）', 'globalPolicy'), renderPolicyRow('项目根目录 CLAUDE.md', '项目专属指令核心记忆库', 'projectClaudePolicy'), renderPolicyRow('项目根目录 AGENTS.md', '项目专属代理规范库', 'projectAgentsPolicy'), renderPolicyRow('子目录指令 (Subdirectories)', '深层子目录中的局部指令文件', 'subdirectoriesPolicy')] }), _jsx(EditorPanel, { controller: controller })] }));
}
//# sourceMappingURL=SettingsCard.js.map