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

test('3. InstructionCoordinator: 注入消息的 source.changes 严格为数组（杜绝 flatMap 崩溃）', async () => {
  const tempHome = createTempDir('home-flatmap');
  const tempProject = createTempDir('proj-flatmap');
  try {
    fs.mkdirSync(path.join(tempProject, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tempHome, 'AGENTS.md'), '# 全局指令\n', 'utf-8');

    const coordinator = new InstructionCoordinator(
      {
        ...DEFAULT_CONFIG,
        globalPolicy: { mode: 'unlimited' }
      },
      tempHome
    );

    // 场景 A: 自主构造消息 (官方无消息)
    const resA = await coordinator.handlePreStep(
      { agent: { cwd: tempProject }, messages: [], step: 1 },
      async () => ({ messages: [] })
    );
    const msgA = resA.messages.find(m => m?.source?.kind === 'agent-instructions');
    assert.ok(msgA);
    assert.ok(Array.isArray(msgA.source.changes), 'syntheticMsg 必须包含 changes 数组');
    assert.doesNotThrow(() => {
      msgA.source.changes.flatMap(c => [c]);
    });

    // 场景 B: 原地替换官方消息，即使官方消息缺少 changes 字段，也能防御性兜底
    const resB = await coordinator.handlePreStep(
      { agent: { cwd: tempProject }, messages: [], step: 1 },
      async () => ({
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: '原消息' }],
          source: { kind: 'agent-instructions', baseline: true }
        }]
      })
    );
    const msgB = resB.messages.find(m => m?.source?.kind === 'agent-instructions');
    assert.ok(msgB);
    assert.ok(Array.isArray(msgB.source.changes), 'updatedMsg 必须兜底补齐 changes 数组');
    assert.doesNotThrow(() => {
      msgB.source.changes.flatMap(c => [c]);
    });
  } finally {
    cleanTempDir(tempHome);
    cleanTempDir(tempProject);
  }
});

test('4. InstructionCoordinator: invalidateCache 显式失效缓存并保留活动配置', async () => {
  const tempHome = createTempDir('home-inval');
  const tempProject = createTempDir('proj-inval');
  try {
    fs.mkdirSync(path.join(tempProject, '.git'), { recursive: true });
    const globalPath = path.join(tempHome, 'AGENTS.md');
    fs.writeFileSync(globalPath, '# 全局原始版本\n', 'utf-8');

    const coordinator = new InstructionCoordinator(
      {
        ...DEFAULT_CONFIG,
        globalPolicy: { mode: 'unlimited', maxBytes: 1024 }
      },
      tempHome
    );

    const firstRender = coordinator.getRenderedInstructions(tempProject);
    assert.ok(firstRender.fullPromptText.includes('全局原始版本'));

    // 动态更新配置（例如改为 disabled）
    coordinator.updateConfig({
      ...DEFAULT_CONFIG,
      globalPolicy: { mode: 'disabled' }
    });
    const secondRender = coordinator.getRenderedInstructions(tempProject);
    assert.equal(secondRender.fullPromptText, '', 'disabled 模式下应为空');

    // 此时外部修改了文件并触发 invalidateCache
    fs.writeFileSync(globalPath, '# 全局修改后版本\n', 'utf-8');
    coordinator.invalidateCache();

    // 再次渲染：验证仍然保持 disabled 配置，未被错误回滚
    const thirdRender = coordinator.getRenderedInstructions(tempProject);
    assert.equal(thirdRender.fullPromptText, '', 'invalidateCache 必须保留当前动态配置');
  } finally {
    cleanTempDir(tempHome);
    cleanTempDir(tempProject);
  }
});
