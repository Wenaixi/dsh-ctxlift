import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InstructionCoordinator } from '../lib/engine/coordinator.js';
import { DEFAULT_CONFIG } from '../lib/config.js';

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `dsh-coord-test-${prefix}-`));
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // 忽略清理异常
  }
}

test('1. InstructionCoordinator: 精准替换官方插件的消息', async () => {
  const tempHome = createTempDir('home');
  const tempProject = createTempDir('proj');
  try {
    fs.mkdirSync(path.join(tempProject, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tempHome, 'AGENTS.md'), '# 全局守护规则\n不可丢失的内容！', 'utf-8');
    fs.writeFileSync(path.join(tempProject, 'CLAUDE.md'), '# 项目规范\n', 'utf-8');

    const coordinator = new InstructionCoordinator(
      {
        ...DEFAULT_CONFIG,
        globalPolicy: { mode: 'unlimited' }
      },
      tempHome
    );

    // 模拟官方插件生成的粗暴消息
    const officialMsg = {
      role: 'user',
      content: [{ type: 'text', text: '<system-reminder>\n只有项目规范\n</system-reminder>' }],
      source: { kind: 'agent-instructions', baseline: true }
    };

    const payload = {
      agent: { cwd: tempProject },
      messages: [],
      step: 1
    };

    const next = async () => ({
      messages: [{ role: 'user', content: '用户提问' }, officialMsg]
    });

    const result = await coordinator.handlePreStep(payload, next);

    assert.equal(result.messages.length, 2);
    const replaced = result.messages[1];
    assert.equal(replaced.source.kind, 'agent-instructions');
    // 验证内容已经被原地替换，包含了我们保全的全局规则
    assert.ok(replaced.content[0].text.includes('全局守护规则'));
    assert.ok(replaced.content[0].text.includes('不可丢失的内容！'));
  } finally {
    cleanTempDir(tempHome);
    cleanTempDir(tempProject);
  }
});

test('2. InstructionCoordinator: 官方插件关闭时自主注入消息', async () => {
  const tempHome = createTempDir('home-syn');
  const tempProject = createTempDir('proj-syn');
  try {
    fs.mkdirSync(path.join(tempProject, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tempHome, 'CLAUDE.md'), '# 全局 CLAUDE 指令\n', 'utf-8');

    const coordinator = new InstructionCoordinator(
      {
        ...DEFAULT_CONFIG,
        globalPreference: 'claude',
        globalPolicy: { mode: 'unlimited' }
      },
      tempHome
    );

    const payload = {
      agent: { cwd: tempProject },
      messages: [],
      step: 1
    };

    // 官方插件未产生任何 agent-instructions 消息
    const next = async () => ({
      messages: [{ role: 'user', content: '你好' }]
    });

    const result = await coordinator.handlePreStep(payload, next);

    assert.equal(result.messages.length, 2);
    const synthetic = result.messages[1];
    assert.equal(synthetic.source.kind, 'agent-instructions');
    assert.ok(synthetic.content[0].text.includes('全局 CLAUDE 指令'));
  } finally {
    cleanTempDir(tempHome);
    cleanTempDir(tempProject);
  }
});
