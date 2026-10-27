import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  resolveGlobalInstructionFile,
  discoverInstructionFiles
} from '../lib/engine/files.js';
import { InstructionsGuardService } from '../lib/remote.js';
import { Context } from '@deepseek-ai/cordis';

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `dsh-test-${prefix}-`));
}

/** TypertRemoteService 的构造是 (ctx, customDshHome)，单测用最小 Context 即可 */
function createService(customDshHome) {
  return new InstructionsGuardService(new Context(), customDshHome);
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // 忽略清理异常
  }
}

test('1. resolveGlobalInstructionFile: 支持 CLAUDE.md 与 AGENTS.md 双模自由切换', () => {
  const tempHome = createTempDir('global-mode');
  try {
    const agentsPath = path.join(tempHome, 'AGENTS.md');
    const claudePath = path.join(tempHome, 'CLAUDE.md');

    fs.writeFileSync(agentsPath, '# 全局 AGENTS 规范\n', 'utf-8');
    fs.writeFileSync(claudePath, '# 全局 CLAUDE 规范\n', 'utf-8');

    // 1. 偏好为 claude
    const claudeRes = resolveGlobalInstructionFile('claude', tempHome);
    assert.equal(claudeRes.activeFilename, 'CLAUDE.md');
    assert.ok(claudeRes.content.includes('全局 CLAUDE 规范'));

    // 2. 偏好为 agents
    const agentsRes = resolveGlobalInstructionFile('agents', tempHome);
    assert.equal(agentsRes.activeFilename, 'AGENTS.md');
    assert.ok(agentsRes.content.includes('全局 AGENTS 规范'));
  } finally {
    cleanTempDir(tempHome);
  }
});

test('2. discoverInstructionFiles: 偏好为 both 时同时载入两者', () => {
  const tempHome = createTempDir('both-mode');
  const tempProject = createTempDir('proj-root');
  try {
    fs.mkdirSync(path.join(tempProject, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tempHome, 'AGENTS.md'), '# 全局 AGENTS\n', 'utf-8');
    fs.writeFileSync(path.join(tempHome, 'CLAUDE.md'), '# 全局 CLAUDE\n', 'utf-8');
    fs.writeFileSync(path.join(tempProject, 'CLAUDE.md'), '# 项目根 CLAUDE\n', 'utf-8');

    const discovered = discoverInstructionFiles(tempProject, 'both', tempHome);
    assert.equal(discovered.length, 3);
    assert.equal(discovered[0].displayPath, '~/.dsh/AGENTS.md');
    assert.equal(discovered[1].displayPath, '~/.dsh/CLAUDE.md');
    assert.equal(discovered[2].displayPath, 'CLAUDE.md');
  } finally {
    cleanTempDir(tempHome);
    cleanTempDir(tempProject);
  }
});

test('3. InstructionsGuardService: RPC 原子保存与文件写入', async () => {
  const tempHome = createTempDir('rpc-save');
  try {
    const service = createService(tempHome);

    const saveRes = await service.saveGlobalContent({
      filename: 'CLAUDE.md',
      content: '# 网页端在线编辑的全局 CLAUDE\n这是来自 Web GUI 的更新！'
    });

    assert.equal(saveRes.ok, true);
    assert.ok(saveRes.sizeBytes > 0);
    assert.ok(fs.existsSync(saveRes.path));

    // 再次读取验证内容一致性
    const info = await service.getGlobalInfo();
    assert.equal(info.activeFilename, 'CLAUDE.md');
    assert.ok(info.content.includes('这是来自 Web GUI 的更新！'));
  } finally {
    cleanTempDir(tempHome);
  }
});

test('4. InstructionsGuardService: 切到不存在的文件显示空文本，保存时自动创建', async () => {
  const tempHome = createTempDir('rpc-switch');
  try {
    const service = createService(tempHome);
    // 先只写一个 AGENTS.md
    await service.saveGlobalContent({
      filename: 'AGENTS.md',
      content: '# 原始全局工作守则\n核心守则不变。'
    });

    // 切到不存在的 CLAUDE.md：只读选择，返回空内容，且不落盘
    const switchRes = await service.switchGlobalFilename({ target: 'CLAUDE.md' });
    assert.equal(switchRes.ok, true);
    assert.equal(switchRes.activeFilename, 'CLAUDE.md');
    assert.equal(switchRes.exists, false);
    assert.equal(switchRes.content, '');
    assert.equal(switchRes.sizeBytes, 0);
    assert.equal(fs.existsSync(path.join(tempHome, 'CLAUDE.md')), false, '切换本身不应创建文件');
    assert.equal(fs.existsSync(path.join(tempHome, 'AGENTS.md')), true, '不能碰已存在的文件');

    // 用户输入后保存：自动创建 CLAUDE.md
    const saveRes = await service.saveGlobalContent({
      filename: 'CLAUDE.md',
      content: '# 新的全局 CLAUDE\n由编辑器创建'
    });
    assert.equal(saveRes.ok, true);
    assert.equal(fs.readFileSync(path.join(tempHome, 'CLAUDE.md'), 'utf-8'), '# 新的全局 CLAUDE\n由编辑器创建');
    // AGENTS.md 内容保持原样，不被克隆污染
    const agentsContent = fs.readFileSync(path.join(tempHome, 'AGENTS.md'), 'utf-8');
    assert.equal(agentsContent, '# 原始全局工作守则\n核心守则不变。');

    // 保存后再次选择，读回的是刚创建的文件
    const afterRes = await service.switchGlobalFilename({ target: 'CLAUDE.md' });
    assert.equal(afterRes.exists, true);
    assert.ok(afterRes.content.includes('由编辑器创建'));
  } finally {
    cleanTempDir(tempHome);
  }
});
