import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldInvalidateCache, FILE_WRITE_TOOLS } from '../lib/engine/cache-invalidation.js'

/**
 * tools/result 事件的真实签名是 (exec, result)，字段名是 exec.name。
 *
 * 旧实现把整个 exec 当成 event、去读 event.tool.name —— 该字段不存在，
 * 判断恒为 false，导致改完 AGENTS.md/CLAUDE.md 后渲染缓存永不失效，
 * 注入的仍是旧内容。
 */
test('写文件工具的 exec.name 触发失效', () => {
  assert.equal(shouldInvalidateCache({ name: 'write' }), true)
  assert.equal(shouldInvalidateCache({ name: 'edit' }), true)
  assert.equal(shouldInvalidateCache({ name: 'apply_patch' }), true)
})

test('读类工具不触发失效', () => {
  assert.equal(shouldInvalidateCache({ name: 'read' }), false)
  assert.equal(shouldInvalidateCache({ name: 'read_image' }), false)
})

test('未知工具与空输入安全返回 false', () => {
  assert.equal(shouldInvalidateCache({ name: 'grep' }), false)
  assert.equal(shouldInvalidateCache(undefined), false)
  assert.equal(shouldInvalidateCache({}), false)
})

test('已移除的 ops_replace 不再出现在监听清单', () => {
  assert.equal(FILE_WRITE_TOOLS.has('ops_replace'), false, 'ops_replace 在本机 DSH 包不存在')
})
