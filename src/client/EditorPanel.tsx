/**
 * DSH Workspace Instructions Global Instruction Editor Panel
 * React component for viewing, editing and switching global instruction files
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import type { InstructionsSettingsController } from './controller.js';

export interface EditorPanelProps {
  controller: InstructionsSettingsController;
}

export function EditorPanel({ controller }: EditorPanelProps) {
  const state = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(onStoreChange),
    () => controller.getState()
  );

  useEffect(() => {
    controller.loadGlobalFile();
  }, [controller]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    controller.setDraftContent(e.target.value);
  };

  const handleSave = async () => {
    await controller.saveGlobalFile();
  };

  const handleSwitchTarget = async (target: 'AGENTS.md' | 'CLAUDE.md') => {
    if (state.activeFilename === target) return;
    if (state.isDirty) {
      const confirmDiscard = window.confirm('当前有未保存的修改，切换文件将丢弃未保存的草稿，是否继续？');
      if (!confirmDiscard) return;
    }
    await controller.switchGlobalFilename(target);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '16px',
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: 'var(--dsw-alias-surface-secondary, #f4f4f5)',
      border: '1px solid var(--dsw-alias-border-subtle, #e4e4e7)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>全局指令文件在线编辑器</span>
          <div style={{
            display: 'inline-flex',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)'
          }}>
            <button
              type="button"
              onClick={() => handleSwitchTarget('AGENTS.md')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: state.activeFilename === 'AGENTS.md'
                  ? 'var(--dsw-alias-brand, #2563eb)'
                  : 'var(--dsw-alias-surface-primary, #ffffff)',
                color: state.activeFilename === 'AGENTS.md' ? '#ffffff' : 'inherit',
                fontWeight: state.activeFilename === 'AGENTS.md' ? 600 : 400
              }}
            >
              AGENTS.md
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTarget('CLAUDE.md')}
              style={{
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
              }}
            >
              CLAUDE.md
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }}>
            大小: {state.fileSizeBytes} 字节
          </span>
          {state.isDirty && (
            <span style={{
              fontSize: '12px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#fef3c7',
              color: '#b45309'
            }}>
              未保存草稿
            </span>
          )}
          <button
            type="button"
            disabled={state.globalFileLoading || state.globalFileSaving || !state.isDirty}
            onClick={handleSave}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: (!state.isDirty || state.globalFileSaving) ? 'not-allowed' : 'pointer',
              backgroundColor: state.isDirty ? 'var(--dsw-alias-brand, #2563eb)' : '#a1a1aa',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            {state.globalFileSaving ? '保存中...' : '保存更改'}
          </button>
        </div>
      </div>

      {state.globalFileError && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '4px',
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          fontSize: '12px'
        }}>
          保存或加载异常: {state.globalFileError}
        </div>
      )}

      <textarea
        value={state.draftContent}
        onChange={handleTextChange}
        placeholder={`在 ~/.dsh/${state.activeFilename} 中输入全局指令内容...`}
        rows={14}
        style={{
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
        }}
      />
    </div>
  );
}
