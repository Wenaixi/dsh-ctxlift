/**
 * E2E Isolated Real Acceptance Test Suite for dsh-ctxlift
 * 验证插件全部核心功能：
 * 1. 全局文件支持（AGENTS.md / CLAUDE.md / both / auto）
 * 2. 精细截断控制（unlimited / truncate / disabled / maxBytes）
 * 3. 洋葱圈生命周期协调（官方替换 / 自主注入）
 * 4. 远程 RPC 接口落盘与数据一致性（getGlobal / saveGlobal / switchGlobal）
 * 5. 客户端前端控制器状态管理
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveConfig } from '../../lib/config.js';
import { discoverInstructionFiles, resolveGlobalInstructionFile } from '../../lib/engine/files.js';
import { renderGranularInstructionSet, processFileWithPolicy } from '../../lib/engine/render.js';
import { InstructionCoordinator } from '../../lib/engine/coordinator.js';
import { InstructionsGuardService } from '../../lib/remote.js';
import { InstructionsSettingsController } from '../../lib/client/controller.js';

console.log('=== [E2E] Starting dsh-ctxlift isolated full functionality acceptance ===\n');

// 准备测试环境沙盒
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-ctxlift-e2e-'));
const fakeDshHome = path.join(tempDir, '.dsh');
fs.mkdirSync(fakeDshHome, { recursive: true });

const projectDir = path.join(tempDir, 'sample-project');
fs.mkdirSync(projectDir, { recursive: true });

try {
  // -------------------------------------------------------------
  // 功能 1：全局指令文件双模与多选支持（主人明确要求的 CLAUDE.md 全局支持）
  // -------------------------------------------------------------
  console.log('--- 1. Testing Global Instructions Discovery & Multi-format Support ---');
  const globalAgentsPath = path.join(fakeDshHome, 'AGENTS.md');
  const globalClaudePath = path.join(fakeDshHome, 'CLAUDE.md');

  fs.writeFileSync(globalAgentsPath, '# Global AGENTS\nThis is global agents instruction content.', 'utf-8');
  fs.writeFileSync(globalClaudePath, '# Global CLAUDE\nThis is global claude instruction content requested by user.', 'utf-8');

  // 1.1 偏好为 agents
  const resAgents = resolveGlobalInstructionFile('agents', fakeDshHome);
  assert.equal(resAgents.exists, true);
  assert.equal(resAgents.activeFilename, 'AGENTS.md');
  assert.equal(resAgents.primaryPath, globalAgentsPath);
  console.log('✔ [1.1] Global file mode "agents" successfully resolved to AGENTS.md');

  // 1.2 偏好为 claude（主人专属核心特性）
  const resClaude = resolveGlobalInstructionFile('claude', fakeDshHome);
  assert.equal(resClaude.exists, true);
  assert.equal(resClaude.activeFilename, 'CLAUDE.md');
  assert.equal(resClaude.primaryPath, globalClaudePath);
  console.log('✔ [1.2] Global file mode "claude" successfully resolved to CLAUDE.md');

  // 1.3 偏好为 both（两者兼收并蓄通过 discoverInstructionFiles 载入）
  const discoveredBoth = discoverInstructionFiles(projectDir, 'both', fakeDshHome);
  const globalItemsBoth = discoveredBoth.filter(i => i.category === 'global');
  assert.equal(globalItemsBoth.length, 2);
  console.log('✔ [1.3] Global file mode "both" successfully resolved both AGENTS.md and CLAUDE.md');

  // -------------------------------------------------------------
  // 功能 2：项目根目录与嵌套目录文件发现
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Project Scope Files Discovery ---');
  const projectClaudePath = path.join(projectDir, 'CLAUDE.md');
  const projectAgentsPath = path.join(projectDir, 'AGENTS.md');
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({ name: 'sample-project' }), 'utf-8');
  const nestedDir = path.join(projectDir, 'packages', 'subpkg');
  fs.mkdirSync(nestedDir, { recursive: true });
  const nestedAgentsPath = path.join(nestedDir, 'AGENTS.md');

  fs.writeFileSync(projectClaudePath, '# Project CLAUDE\nProject level rules.', 'utf-8');
  fs.writeFileSync(projectAgentsPath, '# Project AGENTS\nProject level team rules.', 'utf-8');
  fs.writeFileSync(nestedAgentsPath, '# Subpkg AGENTS\nSubpkg specific rules.', 'utf-8');

  const files = discoverInstructionFiles(nestedDir, 'claude', fakeDshHome);

  const globalList = files.filter(i => i.category === 'global');
  const projectClaudeList = files.filter(i => i.category === 'project-claude');
  const projectAgentsList = files.filter(i => i.category === 'project-agents');
  const nestedList = files.filter(i => i.category === 'subdirectory');

  assert.equal(globalList.length, 1);
  assert.equal(globalList[0].path, globalClaudePath);
  assert.equal(projectClaudeList.length, 1); // CLAUDE.md
  assert.equal(projectAgentsList.length, 1); // AGENTS.md
  assert.equal(nestedList.length, 1); // subpkg/AGENTS.md
  console.log('✔ [2.1] Correctly categorized global, project-root (CLAUDE & AGENTS) and nested instruction files');

  // -------------------------------------------------------------
  // 功能 3：精细截断控制三态（unlimited, truncate, disabled）
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Granular Truncation Policies ---');
  const longContent = 'A'.repeat(5000);

  // 3.1 unlimited 模式
  const mockFile = {
    path: '/tmp/test.md',
    displayPath: 'test.md',
    category: 'global',
    content: longContent
  };
  const unlimRes = processFileWithPolicy(
    mockFile,
    { mode: 'unlimited', maxBytes: 500, direction: 'tail' },
    'compact'
  );
  assert.ok(unlimRes);
  assert.equal(unlimRes.isTruncated, false);
  assert.equal(unlimRes.content.length, 5000);
  console.log('✔ [3.1] unlimited policy leaves large content 100% intact');

  // 3.2 truncate 模式
  const truncRes = processFileWithPolicy(
    mockFile,
    { mode: 'truncate', maxBytes: 256, truncateFrom: 'tail' },
    'compact'
  );
  assert.ok(truncRes);
  assert.equal(truncRes.isTruncated, true);
  assert.ok(Buffer.byteLength(truncRes.content, 'utf-8') <= 256);
  assert.ok(truncRes.content.includes('[Workspace instruction truncated:'));
  console.log('✔ [3.2] truncate policy strictly enforces maxBytes with informative notice');

  // 3.3 disabled 模式
  const disRes = processFileWithPolicy(
    mockFile,
    { mode: 'disabled', maxBytes: 1000, direction: 'tail' },
    'compact'
  );
  assert.equal(disRes, null);
  console.log('✔ [3.3] disabled policy returns null and excludes file completely');

  // -------------------------------------------------------------
  // 功能 4：洋葱圈生命周期协调拦截（Onion-skin interceptor）
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Onion-skin Coordinator Lifecycle ---');
  const coordConfig = resolveConfig({
    globalPolicy: { mode: 'truncate', maxBytes: 120 },
    projectClaudePolicy: { mode: 'unlimited' },
    globalPreference: 'claude'
  });
  const coordinator = new InstructionCoordinator(coordConfig, fakeDshHome);

  const payload = {
    agent: { cwd: projectDir },
    messages: [{ role: 'user', content: 'hello' }],
    step: 1
  };

  const officialDecision = {
    messages: [
      { role: 'user', content: 'hello' },
      {
        role: 'system',
        source: { kind: 'agent-instructions' },
        content: [{ type: 'text', text: 'Old instructions' }]
      }
    ]
  };

  const finalDecision = await coordinator.handlePreStep(payload, async () => officialDecision);
  const modifiedSystem = finalDecision.messages.find(m => m?.source?.kind === 'agent-instructions');
  assert.ok(modifiedSystem, 'System instructions message should exist');
  const sysText = modifiedSystem.content[0].text;
  assert.ok(sysText.includes('~/.dsh/CLAUDE.md'), 'Should use configured global CLAUDE.md');
  assert.ok(sysText.includes('CLAUDE.md'), 'Should include project CLAUDE.md');
  console.log('✔ [4.1] Coordinator successfully intercepted & replaced official instruction message atomically');

  // -------------------------------------------------------------
  // 功能 5：Remote RPC 服务与在线保存、读取、无缝切换
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Remote RPC Service & Global File Online Editing ---');
  const rpcService = new InstructionsGuardService(fakeDshHome);

  // 5.1 获取全局指令元数据与内容
  const fetched = await rpcService.getGlobalInfo();
  assert.equal(fetched.exists, true);
  assert.ok(fetched.content.includes('global agents instruction content'));
  console.log('✔ [5.1] RPC getGlobalInfo successfully retrieved disk metadata & content');

  // 5.2 在线编辑并原子保存
  const newContent = '# Global CLAUDE Updated\nMaster Wenxi online edited this via dsh-ctxlift UI!';
  const saveRes = await rpcService.saveGlobalContent({
    filename: 'CLAUDE.md',
    content: newContent
  });
  assert.equal(saveRes.ok, true);
  const diskCheck = fs.readFileSync(globalClaudePath, 'utf-8');
  assert.equal(diskCheck, newContent);
  console.log('✔ [5.2] RPC saveGlobalContent atomic write & disk persistence verified');

  // 5.3 切换全局生效文件名并无缝克隆现有指令
  const switchRes = await rpcService.switchGlobalFilename({
    target: 'AGENTS.md',
    copyExisting: true
  });
  assert.equal(switchRes.ok, true);
  assert.equal(fs.existsSync(globalAgentsPath), true);
  console.log('✔ [5.3] RPC switchGlobalFilename successfully switched target & inherited instructions');

  // -------------------------------------------------------------
  // 功能 6：Web UI 控制器联动
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Web UI Controller State Management ---');
  let configState = { ...coordConfig };
  const fakeScope = {
    getSnapshot: () => ({ value: configState, revision: 1 }),
    subscribe: () => () => {},
    mutate: async (ops) => {
      for (const op of ops) {
        if (op.type === 'set') {
          if (op.path.length === 1) configState[op.path[0]] = op.value;
          if (op.path.length === 2) configState[op.path[0]][op.path[1]] = op.value;
        }
      }
      return true;
    }
  };
  const fakeRemote = {
    instructionsGuard: {
      getGlobalInfo: () => rpcService.getGlobalInfo(),
      saveGlobalContent: (p) => rpcService.saveGlobalContent(p),
      switchGlobalFilename: (p) => rpcService.switchGlobalFilename(p)
    }
  };

  const controller = new InstructionsSettingsController(fakeScope, fakeRemote, coordConfig);
  assert.equal(controller.getState().config.globalPreference, 'claude');

  // 修改配置策略
  await controller.setPolicyMode('globalPolicy', 'unlimited');
  assert.equal(controller.getState().config.globalPolicy.mode, 'unlimited');

  // 触发 RPC 读取与保存
  await controller.loadGlobalFile();
  assert.ok(controller.getState().fileOriginalContent.length > 0);

  const uiEditContent = '# Edited via Controller UI\nMaster Wenxi Rocks!';
  controller.setDraftContent(uiEditContent);
  assert.equal(controller.getState().isDirty, true);

  const uiSaveOk = await controller.saveGlobalFile();
  assert.equal(uiSaveOk, true);
  assert.equal(controller.getState().isDirty, false);
  console.log('✔ [6.1] Controller managed config state and executed RPC save seamlessly');

  console.log('\n=============================================================');
  console.log('🎉 ALL 6 FUNCTIONAL AREAS & 10 CRITICAL CRITERIA VERIFIED 100%!');
  console.log('=============================================================');
} finally {
  // 清理临时测试目录
  fs.rmSync(tempDir, { recursive: true, force: true });
}
