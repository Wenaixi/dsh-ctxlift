/**
 * DSH Workspace Instructions Granular Truncation Plugin
 * Web Client Entry Point
 */

import React from 'react';
import { InstructionsSettingsController } from './controller.js';
import { SettingsCard } from './SettingsCard.js';

export const name = 'dsh-ctxlift/client';

export const inject = ['slots'];

export function apply(ctx: any) {
  // 单例控制器实例缓存
  let cachedController: InstructionsSettingsController | undefined;

  const getController = () => {
    if (!cachedController) {
      const scope = ctx.configForms?.get?.('dsh-ctxlift');
      const remote = ctx.remote;
      cachedController = new InstructionsSettingsController(scope, remote);
    }
    return cachedController;
  };

  // 1. 注册在插件行的配置展开插槽中
  if (ctx.slots?.register) {
    ctx.slots.register('plugins.row.config', (props: any) => {
      // 仅当展开的是本插件时渲染
      const targetId = props?.pluginId ?? props?.name ?? props?.id;
      if (targetId && targetId !== 'dsh-ctxlift') {
        return null;
      }

      const controller = getController();
      return <SettingsCard controller={controller} />;
    });

    // 2. 同时注册在通用设置区域（如果存在 settings.section 插槽）
    ctx.slots.register('settings.section', (props: any) => {
      if (props?.sectionId && props.sectionId !== 'dsh-ctxlift') {
        return null;
      }
      const controller = getController();
      return <SettingsCard controller={controller} />;
    });
  }
}

export default {
  name,
  inject,
  apply
};

