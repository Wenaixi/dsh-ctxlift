/**
 * DSH Workspace Instructions Settings Main View
 * Displays granular truncation controls and embedded global instruction editor
 */

import React, { useSyncExternalStore } from 'react';
import type { InstructionsSettingsController } from './controller.js';
import { EditorPanel } from './EditorPanel.js';
import type { TruncateMode, GlobalFilePreference } from '../config.js';

export interface SettingsCardProps {
  controller: InstructionsSettingsController;
}

export function SettingsCard({ controller }: SettingsCardProps) {
  const state = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(onStoreChange),
    () => controller.getState()
  );

  const { config } = state;

  const renderPolicyRow = (
    label: string,
    description: string,
    layer: 'globalPolicy' | 'projectClaudePolicy' | 'projectAgentsPolicy' | 'subdirectoriesPolicy'
  ) => {
    const policy = config[layer];

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px',
        borderRadius: '6px',
        backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
        border: '1px solid var(--dsw-alias-border-subtle, #e4e4e7)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{label}</div>
            <div style={{ fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }}>{description}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={policy.mode}
              onChange={(e) => controller.setPolicyMode(layer, e.target.value as TruncateMode)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
                color: 'inherit'
              }}
            >
              <option value="unlimited">不截断 (完整保留)</option>
              <option value="truncate">截断 (按字节上限)</option>
              <option value="disabled">禁用 (不注入)</option>
            </select>

            {policy.mode === 'truncate' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min={256}
                  step={1024}
                  value={policy.maxBytes ?? 65536}
                  onChange={(e) => controller.setPolicyMaxBytes(layer, Number(e.target.value))}
                  style={{
                    width: '90px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
                    textAlign: 'right'
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }}>字节</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '880px', margin: '0 auto' }}>
      {/* 头部标题与说明 */}
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>工作区指令精细化截断与全局管理</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--dsw-alias-text-secondary, #71717a)' }}>
          独立精细控制全局指令、项目根目录 CLAUDE.md 与 AGENTS.md 的截断策略，杜绝原生一刀切丢弃，并支持在 Web 端直接查看与编辑全局守则。
        </p>
      </div>

      {/* 全局文件偏好设置 */}
      <div style={{
        padding: '12px',
        borderRadius: '6px',
        backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
        border: '1px solid var(--dsw-alias-border-subtle, #e4e4e7)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>全局指令文件偏好</div>
            <div style={{ fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #71717a)' }}>
              打破官方硬编码限制，支持全局使用 CLAUDE.md 或两者合并注入
            </div>
          </div>

          <select
            value={config.globalPreference}
            onChange={(e) => controller.setGlobalPreference(e.target.value as GlobalFilePreference)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '4px',
              border: '1px solid var(--dsw-alias-border-strong, #d4d4d8)',
              backgroundColor: 'var(--dsw-alias-surface-primary, #ffffff)',
              color: 'inherit'
            }}
          >
            <option value="auto">自动探测 (存在优先)</option>
            <option value="claude">全局仅使用 CLAUDE.md</option>
            <option value="agents">全局仅使用 AGENTS.md</option>
            <option value="both">两者同时载入 (AGENTS + CLAUDE)</option>
          </select>
        </div>
      </div>

      {/* 四层精细截断规则 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {renderPolicyRow('全局指令 (Global)', '生效于所有会话与项目的全局工作守则（~/.dsh/）', 'globalPolicy')}
        {renderPolicyRow('项目根目录 CLAUDE.md', '项目专属指令核心记忆库', 'projectClaudePolicy')}
        {renderPolicyRow('项目根目录 AGENTS.md', '项目专属代理规范库', 'projectAgentsPolicy')}
        {renderPolicyRow('子目录指令 (Subdirectories)', '深层子目录中的局部指令文件', 'subdirectoriesPolicy')}
      </div>

      {/* 全局在线编辑器 */}
      <EditorPanel controller={controller} />
    </div>
  );
}
