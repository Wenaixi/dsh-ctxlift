import test from 'node:test';
import assert from 'node:assert/strict';

import { InstructionsSettingsController } from '../lib/client/controller.js';

test('InstructionsSettingsController manages configuration state and updates', async () => {
  let mutatedOps = null;
  const mockConfigScope = {
    getSnapshot: () => ({
      value: {
        globalPreference: 'CLAUDE.md',
        globalPolicy: { mode: 'unlimited', maxBytes: 131072 },
        projectClaudePolicy: { mode: 'truncate', maxBytes: 32768 }
      },
      revision: 1
    }),
    mutate: async (ops) => {
      mutatedOps = ops;
      return true;
    }
  };

  const controller = new InstructionsSettingsController(mockConfigScope, null);
  const state = controller.getState();
  assert.equal(state.config.globalPreference, 'CLAUDE.md');
  assert.equal(state.config.globalPolicy.mode, 'unlimited');
  assert.equal(state.config.projectClaudePolicy.maxBytes, 32768);

  // 更新配置项并保存
  await controller.setPolicyMode('projectClaudePolicy', 'unlimited');
  assert.ok(mutatedOps);
  assert.equal(mutatedOps.length, 1);
  assert.deepEqual(mutatedOps[0].path, ['projectClaudePolicy', 'mode']);
  assert.equal(mutatedOps[0].value, 'unlimited');
});

test('InstructionsSettingsController interacts with Remote RPC service', async () => {
  let savedPayload = null;
  const mockRemote = {
    instructionsGuard: {
      getGlobalInfo: async () => ({
        primaryPath: 'C:/Users/Administrator/.dsh/CLAUDE.md',
        activeFilename: 'CLAUDE.md',
        exists: true,
        content: '# Existing Global',
        sizeBytes: 17,
        lastModifiedMs: Date.now()
      }),
      saveGlobalContent: async (payload) => {
        savedPayload = payload;
        return { ok: true, sizeBytes: payload.content.length };
      },
      switchGlobalFilename: async () => ({ ok: true })
    }
  };

  const controller = new InstructionsSettingsController(null, mockRemote);
  await controller.loadGlobalFile();

  const state = controller.getState();
  assert.equal(state.activeFilename, 'CLAUDE.md');
  assert.equal(state.draftContent, '# Existing Global');
  assert.equal(state.isDirty, false);

  // 编辑草稿内容
  controller.setDraftContent('# Updated Global');
  assert.equal(controller.getState().isDirty, true);

  // 保存
  const success = await controller.saveGlobalFile();
  assert.equal(success, true);
  assert.ok(savedPayload);
  assert.equal(savedPayload.filename, 'CLAUDE.md');
  assert.equal(savedPayload.content, '# Updated Global');
  assert.equal(controller.getState().isDirty, false);
});
