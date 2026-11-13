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
