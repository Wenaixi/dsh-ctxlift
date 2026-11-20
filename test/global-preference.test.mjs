import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveGlobalInstructionFile } from '../lib/engine/files.js'

/**
 * 编辑器侧的全局文件解析必须尊重用户的 globalPreference。
 *
 * remote.getGlobalInfo 曾硬编码 'auto'：当用户偏好 claude 且两份文件都在时，
 * auto 会优先 AGENTS.md，导致编辑器显示的文件与引擎实际加载的不一致。
 */

function makeHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxlift-pref-'))
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# agents\n', 'utf-8')
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# claude\n', 'utf-8')
  return dir
}

test('偏好 claude 且两份都在时选中 CLAUDE.md', () => {
  const home = makeHome()
  try {
    const res = resolveGlobalInstructionFile('claude', home)
    assert.equal(path.basename(res.primaryPath), 'CLAUDE.md')
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('偏好 agents 且两份都在时选中 AGENTS.md', () => {
  const home = makeHome()
  try {
    const res = resolveGlobalInstructionFile('agents', home)
    assert.equal(path.basename(res.primaryPath), 'AGENTS.md')
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('偏好 auto 且两份都在时优先 AGENTS.md', () => {
  const home = makeHome()
  try {
    const res = resolveGlobalInstructionFile('auto', home)
    assert.equal(path.basename(res.primaryPath), 'AGENTS.md')
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

/**
 * 构造契约回归：ctx.plugin(Service, config) 只把 config 交给构造函数的第二个参数，
 * 第三参恒为 undefined。若 Service 构造仍按 (ctx, customDshHome, getPreference) 解析，
 * getPreference 会静默退回 'auto'，于是编辑器显示的文件与引擎实际加载的不一致。
 */
test('InstructionsGuardService 能从单参 config 中取到 getPreference', async () => {
  const { Context } = await import('@deepseek-ai/cordis')
  const { InstructionsGuardService } = await import('../lib/remote.js')
  const root = new Context()
  const svc = new InstructionsGuardService(root, {
    getPreference: () => 'claude',
  })
  assert.equal(svc.getPreference(), 'claude')
  try { svc[Symbol.dispose]?.() } catch { /* 宿主未提供可释放资源 */ }
})

test('InstructionsGuardService 兼容旧的字符串位置传法', async () => {
  const { Context } = await import('@deepseek-ai/cordis')
  const { InstructionsGuardService } = await import('../lib/remote.js')
  const root = new Context()
  const home = makeHome()
  try {
    const svc = new InstructionsGuardService(root, home, () => 'claude')
    assert.equal(svc.customDshHome, home)
    assert.equal(svc.getPreference(), 'claude')
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
