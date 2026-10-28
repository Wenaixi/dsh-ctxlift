import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  resolveGlobalInstructionFile,
  discoverInstructionFiles,
  findProjectRoot
} from '../lib/engine/files.js';

test('Global file discovery supports AGENTS.md, CLAUDE.md and auto mode', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-global-'));
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 1. 当两个文件都不存在时
  const resEmpty = resolveGlobalInstructionFile('auto', tmpDir);
  assert.equal(resEmpty.exists, false);
  assert.equal(resEmpty.activeFilename, 'AGENTS.md');

  // 2. 仅创建 CLAUDE.md
  const claudePath = path.join(tmpDir, 'CLAUDE.md');
  fs.writeFileSync(claudePath, '# Global Claude Instructions', 'utf-8');

  // 在 auto 模式下应该自动识别并优先启用存在的 CLAUDE.md
  const resClaude = resolveGlobalInstructionFile('auto', tmpDir);
  assert.equal(resClaude.exists, true);
  assert.equal(resClaude.activeFilename, 'CLAUDE.md');
  assert.equal(resClaude.content, '# Global Claude Instructions');

  // 3. 显式指定偏好为 AGENTS.md（即便不存在）
  const resPreferAgents = resolveGlobalInstructionFile('AGENTS.md', tmpDir);
  assert.equal(resPreferAgents.exists, false);
  assert.equal(resPreferAgents.activeFilename, 'AGENTS.md');

  // 4. 同时创建 AGENTS.md
  const agentsPath = path.join(tmpDir, 'AGENTS.md');
  fs.writeFileSync(agentsPath, '# Global Agents Instructions', 'utf-8');

  // 当两者都存在时，指定 CLAUDE.md 偏好
  const resPreferClaude = resolveGlobalInstructionFile('CLAUDE.md', tmpDir);
  assert.equal(resPreferClaude.exists, true);
  assert.equal(resPreferClaude.activeFilename, 'CLAUDE.md');
  assert.equal(resPreferClaude.content, '# Global Claude Instructions');
});

test('Project file discovery distinguishes root and nested instructions', (t) => {
  const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-proj-'));
  const emptyGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-empty-global-'));
  t.after(() => {
    fs.rmSync(tmpProject, { recursive: true, force: true });
    fs.rmSync(emptyGlobalDir, { recursive: true, force: true });
  });

  // 创建项目根目录特征标记 (.git)
  fs.mkdirSync(path.join(tmpProject, '.git'), { recursive: true });

  // 创建根目录文件
  fs.writeFileSync(path.join(tmpProject, 'CLAUDE.md'), 'Root Claude', 'utf-8');
  fs.writeFileSync(path.join(tmpProject, 'AGENTS.md'), 'Root Agents', 'utf-8');

  // 创建子目录文件
  const subDir = path.join(tmpProject, 'packages', 'core');
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, 'AGENTS.md'), 'Sub Agents', 'utf-8');

  // 模拟当前会话处于子目录 packages/core 下执行
  const files = discoverInstructionFiles(subDir, 'auto', emptyGlobalDir);
  assert.equal(files.length, 3);

  const rootClaude = files.find(f => f.category === 'project-claude');
  assert.ok(rootClaude);
  assert.equal(rootClaude.content, 'Root Claude');

  const rootAgents = files.find(f => f.category === 'project-agents');
  assert.ok(rootAgents);
  assert.equal(rootAgents.content, 'Root Agents');

  const subFile = files.find(f => f.category === 'subdirectory');
  assert.ok(subFile);
  assert.equal(subFile.content, 'Sub Agents');
});

test('findProjectRoot halts at home directory boundary and excludes home itself', () => {
  const home = path.resolve(os.homedir());
  
  // 1. 家目录本身绝不能被当做项目根，应回退至上一级
  const rootFromHome = findProjectRoot(home);
  assert.equal(rootFromHome, path.dirname(home));

  // 2. 家目录的普通子目录（无标记）回退到该子目录自身，不向上穿透到家目录
  const docDir = path.join(home, 'Documents');
  if (fs.existsSync(docDir)) {
    const rootFromDocs = findProjectRoot(docDir);
    assert.equal(rootFromDocs, docDir);
  }
});

test('discoverInstructionFiles never loads ~/CLAUDE.md when cwd is home directory', (t) => {
  const home = path.resolve(os.homedir());
  const emptyGlobalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-empty-global-'));
  t.after(() => {
    fs.rmSync(emptyGlobalDir, { recursive: true, force: true });
  });

  // 当会话 cwd 是家目录时，即使家目录存在 CLAUDE.md，也绝对不能加载 project-claude 或 subdirectory
  const filesAtHome = discoverInstructionFiles(home, 'auto', emptyGlobalDir);
  const homeClaude = filesAtHome.find(f => f.file.toLowerCase().includes('claude.md'));
  assert.equal(homeClaude, undefined, '~/CLAUDE.md must NEVER be loaded when cwd is home');
});
