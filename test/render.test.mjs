import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  truncateUtf8Safe,
  processFileWithPolicy,
  renderGranularInstructionSet
} from '../lib/engine/render.js';
import { DEFAULT_CONFIG } from '../lib/config.js';

test('1. truncateUtf8Safe: UTF-8 安全性与多字节汉字截断', () => {
  const chineseText = '你好世界，这是一段用来测试 UTF-8 字节截断的中文文本。每个汉字占三个字节！';
  // 截取 15 字节（相当于 5 个汉字），不带提示语
  const { text, isTruncated } = truncateUtf8Safe(chineseText, 15);
  assert.equal(isTruncated, true);
  // 必须没有损坏字符
  assert.ok(!text.includes('\uFFFD'));
  const byteLen = Buffer.byteLength(text, 'utf-8');
  assert.ok(byteLen <= 15, `实际字节数 ${byteLen} 超过了上限 15`);
});

test('2. truncateUtf8Safe: 保留头部并截断尾部', () => {
  const multiline = '第一行内容\n第二行内容\n第三行内容\n第四行内容\n第五行内容';
  
  // 截断模式固定保留开头、截断尾部
  const tailRes = truncateUtf8Safe(multiline, 40, 'tail');
  assert.ok(tailRes.text.includes('第一行内容'));
  assert.ok(!tailRes.text.includes('第五行内容'));
});

test('3. processFileWithPolicy: unlimited 模式完整保留大文本', () => {
  const largeContent = '# 全局工作守则\n' + '这里是持续维护的重要守则内容。\n'.repeat(500);
  const rawBytes = Buffer.byteLength(largeContent, 'utf-8');
  assert.ok(rawBytes > 10000, '测试文本必须大于 10KB');

  const fileItem = {
    path: '/home/user/.dsh/AGENTS.md',
    displayPath: '~/.dsh/AGENTS.md',
    category: 'global',
    content: largeContent
  };

  const result = processFileWithPolicy(
    fileItem,
    { mode: 'unlimited', maxBytes: 1024 }
  );

  assert.ok(result);
  assert.equal(result.isTruncated, false);
  assert.equal(result.renderedBytes, rawBytes);
  assert.equal(result.content, largeContent);
});

test('4. processFileWithPolicy: disabled 模式完全剔除文件', () => {
  const fileItem = {
    path: '/project/CLAUDE.md',
    displayPath: 'CLAUDE.md',
    category: 'project-claude',
    content: '这是项目根目录的 CLAUDE.md'
  };

  const result = processFileWithPolicy(
    fileItem,
    { mode: 'disabled' }
  );

  assert.equal(result, null);
});

test('5. renderGranularInstructionSet: 多层级精细独立控制与官方模板格式', () => {
  const files = [
    {
      path: '/home/user/.dsh/AGENTS.md',
      displayPath: '~/.dsh/AGENTS.md',
      category: 'global',
      content: '# 全局规则\n绝对不能丢弃的全局规则！'
    },
    {
      path: '/workspace/CLAUDE.md',
      displayPath: 'CLAUDE.md',
      category: 'project-claude',
      content: '# 项目规范\n'.repeat(50)
    },
    {
      path: '/workspace/AGENTS.md',
      displayPath: 'AGENTS.md',
      category: 'project-agents',
      content: '# 项目代理规范\n'
    }
  ];

  const config = {
    ...DEFAULT_CONFIG,
    globalPolicy: { mode: 'unlimited' },
    projectClaudePolicy: { mode: 'truncate', maxBytes: 128 },
    projectAgentsPolicy: { mode: 'disabled' }
  };

  const renderResult = renderGranularInstructionSet(files, config);

  // 1. 结构与条数验证
  assert.equal(renderResult.files.length, 2, '包含全局与项目 CLAUDE，排除项目 AGENTS');
  assert.equal(renderResult.files[0].displayPath, '~/.dsh/AGENTS.md');
  assert.equal(renderResult.files[0].isTruncated, false);
  assert.equal(renderResult.files[1].displayPath, 'CLAUDE.md');
  assert.equal(renderResult.files[1].isTruncated, true);

  // 2. 官方原生契约验证
  assert.ok(renderResult.fullPromptText.startsWith('<system-reminder>\n'));
  assert.ok(renderResult.fullPromptText.endsWith('\n</system-reminder>'));
  assert.ok(renderResult.fullPromptText.includes('Instructions from: ~/.dsh/AGENTS.md'));
  assert.ok(renderResult.fullPromptText.includes('Instructions from: CLAUDE.md'));
  assert.ok(!renderResult.fullPromptText.includes('Instructions from: AGENTS.md'));
});
