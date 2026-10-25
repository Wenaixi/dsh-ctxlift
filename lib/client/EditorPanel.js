import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * DSH Workspace Instructions Global Instruction Editor Panel
 * React component for viewing, editing and switching global instruction files
 */
import { useEffect, useSyncExternalStore } from 'react';
export function EditorPanel({ controller }) {
    const state = useSyncExternalStore((onStoreChange) => controller.subscribe(onStoreChange), () => controller.getState());
    useEffect(() => {
        controller.loadGlobalFile();
    }, [controller]);
    const handleTextChange = (e) => {
        controller.setDraftContent(e.target.value);
    };
    const handleSave = async () => {
        await controller.saveGlobalFile();
    };
    const handleSwitchTarget = async (target) => {
        if (state.activeFilename === target)
            return;
        if (state.isDirty) {
            const confirmDiscard = window.confirm('当前有未保存的修改，切换文件将丢弃未保存的草稿，是否继续？');
            if (!confirmDiscard)
                return;
        }
        await controller.switchGlobalFilename(target);
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '16px',
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: 'var(--dsw-alias-surface-secondary, #f4f4f5)',
            border: '1px solid var(--dsw-alias-border-subtle, #e4e4e7)'
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx("span", { style: { fontWeight: 600, fontSize: '14px' }, children: "\u5168\u5C40\u6307\u4EE4\u6587\u4EF6\u5728\u7EBF\u7F16\u8F91\u5668" }), _jsxs("div", { style: {
                                    display: 'inline-flex',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)'
                                }, children: [_jsx("button", { type: "button", onClick: () => handleSwitchTarget('AGENTS.md'), style: {
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            backgroundColor: state.activeFilename === 'AGENTS.md'
                                                ? 'var(--dsw-alias-brand, #2563eb)'
                                                : 'var(--dsw-alias-surface-primary, #ffffff)',
                                            color: state.activeFilename === 'AGENTS.md' ? '#ffffff' : 'inherit',
                                            fontWeight: state.activeFilename === 'AGENTS.md' ? 600 : 400
                                        }, children: "AGENTS.md" }), _jsx("button", { type: "button", onClick: () => handleSwitchTarget('CLAUDE.md'), style: {
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderLeft: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                                            backgroundColor: state.activeFilename === 'CLAUDE.md'
                                                ? 'var(--dsw-alias-brand, #2563eb)'
                                                : 'var(--dsw-alias-surface-primary, #ffffff)',
                                            color: state.activeFilename === 'CLAUDE.md' ? '#ffffff' : 'inherit',
                                            fontWeight: state.activeFilename === 'CLAUDE.md' ? 600 : 400
                                        }, children: "CLAUDE.md" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsxs("span", { style: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }, children: ["\u5927\u5C0F: ", state.fileSizeBytes, " \u5B57\u8282"] }), state.isDirty && (_jsx("span", { style: {
                                    fontSize: '12px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309'
                                }, children: "\u672A\u4FDD\u5B58\u8349\u7A3F" })), _jsx("button", { type: "button", disabled: state.globalFileLoading || state.globalFileSaving || !state.isDirty, onClick: handleSave, style: {
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: (!state.isDirty || state.globalFileSaving) ? 'not-allowed' : 'pointer',
                                    backgroundColor: state.isDirty ? 'var(--dsw-alias-brand, #2563eb)' : '#a1a1aa',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px'
                                }, children: state.globalFileSaving ? '保存中...' : '保存更改' })] })] }), state.globalFileError && (_jsxs("div", { style: {
                    padding: '8px 12px',
                    borderRadius: '4px',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    fontSize: '12px'
                }, children: ["\u4FDD\u5B58\u6216\u52A0\u8F7D\u5F02\u5E38: ", state.globalFileError] })), _jsx("textarea", { value: state.draftContent, onChange: handleTextChange, placeholder: `在 ~/.dsh/${state.activeFilename} 中输入全局指令内容...`, rows: 14, style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    borderRadius: '6px',
                    border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                    backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
                    color: 'var(--dsw-alias-text-primary, #18181b)',
                    resize: 'vertical'
                } })] }));
}
//# sourceMappingURL=EditorPanel.js.map