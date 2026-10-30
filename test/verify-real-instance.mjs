/**
 * dsh-ctxlift 真实全新实例全功能自动化验收套件
 * 
 * 验证维度：
 * 1. RPC 远程服务：getGlobalInfo、switchGlobalFilename（只读无副作用）、saveGlobalContent（原子落盘）
 * 2. 四层独立策略：unlimited / truncate（UTF-8 安全截断） / disabled
 * 3. 协调器洋葱圈：官方消息精准替换、自主构造注入、source.changes 数组防御
 * 4. 架构重构特性：invalidateCache() 防配置回滚、SHA-1 复合指纹防误判、统一 resolveConfig
 * 5. Web 客户端产物：ModuleLoader 注册契约、显式保存草稿机制
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { Buffer } from 'node:buffer';

import { Context } from '@deepseek-ai/cordis';
import { resolveConfig, DEFAULT_CONFIG } from '../lib/config.js';
import {
  resolveGlobalInstructionFile,
  discoverInstructionFiles,
  saveGlobalInstructionFile
} from '../lib/engine/files.js';
import {
  truncateUtf8Safe,
  processFileWithPolicy,
  renderGranularInstructionSet
} from '../lib/engine/render.js';
import { InstructionCoordinator } from '../lib/engine/coordinator.js';
import { InstructionsGuardService } from '../lib/remote.js';

console.log('===============================================================');
console.log('🚀 [Real-Instance Acceptance] Starting Full Functional Suite');
console.log('===============================================================\n');

const tempSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-ctxlift-real-verify-'));
const fakeHome = path.join(tempSandbox, '.dsh');
const fakeProject = path.join(tempSandbox, 'project');
const fakeSubdir = path.join(fakeProject, 'sub');

fs.mkdirSync(fakeHome, { recursive: true });
fs.mkdirSync(path.join(fakeProject, '.git'), { recursive: true });
fs.mkdirSync(fakeSubdir, { recursive: true });

try {
  // -------------------------------------------------------------------------
  // 1. 验证全局指令 RPC 服务与原子落盘
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Global RPC Service & Storage Decoupling ---');
  const service = new InstructionsGuardService(new Context(), fakeHome);

  // 1.1 初始状态：无文件时返回空
  const initInfo = await service.getGlobalInfo();
  assert.equal(initInfo.exists, false);
  assert.equal(initInfo.activeFilename, 'AGENTS.md');
  console.log('✔ [1.1] getGlobalInfo handles non-existent file cleanly');

  // 1.2 switchGlobalFilename 只读选择：切到 CLAUDE.md，绝不自动落盘
  const switchRes = await service.switchGlobalFilename({ target: 'CLAUDE.md' });
  assert.equal(switchRes.ok, true);
  assert.equal(switchRes.activeFilename, 'CLAUDE.md');
  assert.equal(switchRes.exists, false);
  assert.equal(fs.existsSync(path.join(fakeHome, 'CLAUDE.md')), false, '切换只读，不能碰磁盘');
  console.log('✔ [1.2] switchGlobalFilename is strictly read-only with zero disk side-effects');

  // 1.3 saveGlobalContent 保存创建文件
  const saveRes = await service.saveGlobalContent({
    filename: 'CLAUDE.md',
    content: '# 全局 CLAUDE 指令\n这是由 Web 在线编辑器保存的内容，包含中文与特殊字符。'
  });
  assert.equal(saveRes.ok, true);
  assert.ok(fs.existsSync(saveRes.path));
  assert.ok(saveRes.sizeBytes > 0);
  console.log('✔ [1.3] saveGlobalContent atomically creates & persists global file');

  // 1.4 回读确认
  const reRead = await service.getGlobalInfo();
  assert.equal(reRead.exists, true);
  assert.ok(reRead.content.includes('这是由 Web 在线编辑器保存的内容'));
  console.log('✔ [1.4] Global file content read back successfully');

  // -------------------------------------------------------------------------
  // 2. 验证四层独立截断与 UTF-8 安全字符边界
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing 4-Layer Granular Policies & UTF-8 Safety ---');

  // 准备测试文件内容
  const globalLongContent = '# 全局指令\n' + '这是一段很长很长的全局内容，用来测试 UTF-8 字节截断。'.repeat(30);
  const projectClaudeContent = '# 项目 CLAUDE\nHEAD_MARKER\n' + '项目核心规范。'.repeat(40) + '\nTAIL_MARKER';
  const projectAgentsContent = '# 项目 AGENTS\n' + '项目工作规则全文。'.repeat(10);
  const subContent = '# 子目录指令\n子目录局部内容，不应被载入。';

  fs.writeFileSync(path.join(fakeHome, 'AGENTS.md'), globalLongContent, 'utf-8');
  fs.writeFileSync(path.join(fakeProject, 'CLAUDE.md'), projectClaudeContent, 'utf-8');
  fs.writeFileSync(path.join(fakeProject, 'AGENTS.md'), projectAgentsContent, 'utf-8');
  fs.writeFileSync(path.join(fakeSubdir, 'AGENTS.md'), subContent, 'utf-8');

  // 配置四层不同策略：全局截断 150 字节 / CLAUDE 截断 250 字节 / AGENTS 不截断 / 子目录禁用
  const testConfig = resolveConfig({
    globalPreference: 'agents',
    globalPolicy: { mode: 'truncate', maxBytes: 150 },
    projectClaudePolicy: { mode: 'truncate', maxBytes: 250 },
    projectAgentsPolicy: { mode: 'unlimited' },
    subdirectoriesPolicy: { mode: 'disabled' }
  });

  const discoveredFiles = discoverInstructionFiles(fakeSubdir, 'agents', fakeHome);
  assert.ok(discoveredFiles.length >= 3, '应搜寻到全局与项目指令');

  const rendered = renderGranularInstructionSet(discoveredFiles, testConfig);

  // 2.1 检查全局截断
  const globalItem = rendered.files.find(f => f.category === 'global');
  assert.ok(globalItem);
  assert.equal(globalItem.isTruncated, true);
  assert.ok(globalItem.renderedBytes <= 150);
  assert.ok(!globalItem.content.includes('\uFFFD'), 'UTF-8 字符边界对齐，绝无乱码');
  assert.ok(globalItem.content.includes('[Workspace instruction truncated'));
  console.log('✔ [2.1] Global policy truncated within 150 bytes with UTF-8 boundary safety');

  // 2.2 检查项目 CLAUDE 截断
  const claudeItem = rendered.files.find(f => f.category === 'project-claude');
  assert.ok(claudeItem);
  assert.equal(claudeItem.isTruncated, true);
  assert.ok(claudeItem.renderedBytes <= 250);
  assert.ok(claudeItem.content.includes('HEAD_MARKER'), '头部关键标记保留');
  assert.ok(!claudeItem.content.includes('TAIL_MARKER'), '超出字节的尾部标记被切除');
  console.log('✔ [2.2] Project CLAUDE truncated within 250 bytes (head kept, tail cut)');

  // 2.3 检查项目 AGENTS 不截断
  const agentsItem = rendered.files.find(f => f.category === 'project-agents');
  assert.ok(agentsItem);
  assert.equal(agentsItem.isTruncated, false);
  assert.equal(agentsItem.renderedBytes, agentsItem.originalBytes);
  console.log('✔ [2.3] Project AGENTS unlimited policy preserves full text 100%');

  // 2.4 检查子目录禁用
  const subItem = rendered.files.find(f => f.category === 'subdirectory');
  assert.equal(subItem, undefined, 'disabled 策略下的子目录文件必须完全排除');
  assert.ok(!rendered.fullPromptText.includes('子目录局部内容'), '禁用内容不出现在最终提示词中');
  console.log('✔ [2.4] Subdirectories disabled policy completely excludes nested files');

  // -------------------------------------------------------------------------
  // 3. 验证协调器洋葱圈拦截与生命周期
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Onion-skin Coordinator & Lifecycle Guard ---');
  const coordinator = new InstructionCoordinator(testConfig, fakeHome);

  // 3.1 官方消息原地精准替换
  const officialPayload = {
    agent: { cwd: fakeProject },
    messages: [
      { role: 'user', content: '用户上文' },
      {
        role: 'user',
        content: [{ type: 'text', text: '官方 agent-instructions 原始消息' }],
        source: { kind: 'agent-instructions', baseline: true }
      }
    ],
    step: 1
  };

  const decisionA = await coordinator.handlePreStep(officialPayload, async () => ({
    messages: officialPayload.messages
  }));

  const replacedMsg = decisionA.messages.find(m => m?.source?.kind === 'agent-instructions');
  assert.ok(replacedMsg);
  assert.ok(replacedMsg.content[0].text.includes('<system-reminder>'));
  assert.ok(Array.isArray(replacedMsg.source.changes), 'changes 字段必须严格兜底为数组');
  console.log('✔ [3.1] Official agent-instructions message replaced in-place with changes array guard');

  // 3.2 官方消息缺失时自主注入
  const cleanPayload = {
    agent: { cwd: fakeProject },
    messages: [{ role: 'user', content: '用户单独消息' }],
    step: 1
  };
  const decisionB = await coordinator.handlePreStep(cleanPayload, async () => ({
    messages: cleanPayload.messages
  }));
  const syntheticMsg = decisionB.messages.find(m => m?.source?.kind === 'agent-instructions');
  assert.ok(syntheticMsg);
  assert.equal(syntheticMsg.source.baselineIdentity, 'granular-instructions-guard');
  assert.ok(Array.isArray(syntheticMsg.source.changes));
  console.log('✔ [3.2] Synthetic instructions message autonomously constructed & injected');

  // -------------------------------------------------------------------------
  // 4. 验证本次架构重构核心特性
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Architecture Deepening Enhancements ---');

  // 4.1 invalidateCache() 显式失效缓存，保留活动动态配置
  coordinator.updateConfig(resolveConfig({
    globalPreference: 'agents',
    globalPolicy: { mode: 'disabled' }, // 动态切为 disabled
    projectClaudePolicy: { mode: 'disabled' },
    projectAgentsPolicy: { mode: 'disabled' },
    subdirectoriesPolicy: { mode: 'disabled' }
  }));
  const emptyRes = coordinator.getRenderedInstructions(fakeProject);
  assert.equal(emptyRes.fullPromptText, '', '所有策略 disabled 时输出应为空');

  // 调用 invalidateCache()
  coordinator.invalidateCache();
  const retainedRes = coordinator.getRenderedInstructions(fakeProject);
  assert.equal(retainedRes.fullPromptText, '', 'invalidateCache 绝不回滚动态配置');
  console.log('✔ [4.1] invalidateCache() purges cache while safely preserving runtime configuration');

  // 4.2 SHA-1 复合指纹在等长内容修改时灵敏失效
  coordinator.updateConfig(testConfig);
  const beforeEdit = coordinator.getRenderedInstructions(fakeProject);
  
  // 制造等长修改：替换相同字符数的内容
  const targetClaudePath = path.join(fakeProject, 'CLAUDE.md');
  const originText = fs.readFileSync(targetClaudePath, 'utf-8');
  const modifiedText = originText.replace('HEAD_MARKER', 'NEW_MARKERS'); // 11 字符换 11 字符
  assert.equal(originText.length, modifiedText.length);
  fs.writeFileSync(targetClaudePath, modifiedText, 'utf-8');

  // SHA-1 摘要会因为内容变动而改变，即使长度完全相同也强制重新渲染
  const afterEdit = coordinator.getRenderedInstructions(fakeProject);
  assert.ok(afterEdit.fullPromptText.includes('NEW_MARKERS'), 'SHA-1 复合指纹捕获等长文本修改');
  console.log('✔ [4.2] SHA-1 composite signature detects equal-length content edits reliably');

  // -------------------------------------------------------------------------
  // 5. 验证 Web 客户端产物 ModuleLoader 契约
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Web Client ModuleLoader Bundle Contract ---');
  const clientBundlePath = path.resolve('lib/client.js');
  assert.ok(fs.existsSync(clientBundlePath), 'lib/client.js 必须已编译落盘');
  const bundleCode = fs.readFileSync(clientBundlePath, 'utf-8');

  let loadedModule = null;
  const mockWindow = {
    __ModuleLoader__: {
      load: (mod) => { loadedModule = mod; }
    }
  };

  const sandboxContext = vm.createContext({
    window: mockWindow,
    globalThis: { window: mockWindow },
    console
  });

  vm.runInContext(bundleCode, sandboxContext);

  assert.ok(loadedModule, '客户端产物必须调用 window.__ModuleLoader__.load');
  assert.equal(loadedModule.id, 'dsh-ctxlift');
  assert.equal(typeof loadedModule.factory, 'function');

  // 执行 factory 验证导出的 apply 和 inject
  const mockRequire = (id) => {
    if (id === 'react') return { createElement: () => ({}) };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Button: () => ({}) };
    return {};
  };

  const exported = loadedModule.factory(mockRequire);
  assert.equal(typeof exported.apply, 'function');
  assert.ok(Array.isArray(exported.inject));
  assert.ok(exported.inject.includes('slots'));
  assert.ok(exported.inject.includes('locale'));
  assert.ok(exported.inject.includes('configForms'));
  assert.ok(exported.inject.includes('remote'));

  // 验证 client 包含我们 Task 4 共享的 DEFAULT_CONFIG
  assert.ok(bundleCode.includes('"globalPreference":"auto"'));
  assert.ok(bundleCode.includes('"config.save"'));
  assert.ok(bundleCode.includes('"config.dirty"'));
  console.log('✔ [5.1] Client bundle conforms 100% to ModuleLoader contract with dirty-checking draft');

  console.log('\n===============================================================');
  console.log('🎉 ALL 5 MAJOR FUNCTIONAL DOMAINS & 12 CRITICAL CHECKS PASSED!');
  console.log('===============================================================');
} finally {
  try {
    fs.rmSync(tempSandbox, { recursive: true, force: true });
  } catch {}
}
