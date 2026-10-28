/**
 * DSH Workspace Instructions File Discovery and Multi-Mode Global File Manager
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { InstructionFileItem, InstructionFileCategory } from './render.js';
import type { GlobalFilePreference } from '../config.js';

export interface GlobalFileResolution {
  primaryPath: string;
  alternatePath?: string;
  activeFilename: 'AGENTS.md' | 'CLAUDE.md';
  exists: boolean;
  content: string;
  sizeBytes: number;
  lastModifiedMs: number;
}

/**
 * 获取 DSH 全局配置目录 (~/.dsh 或 $DSH_HOME)
 */
export function getDshHomeDir(): string {
  const envDshHome = process.env.DSH_HOME;
  if (envDshHome && envDshHome.trim().length > 0) {
    return path.resolve(envDshHome);
  }
  return path.join(os.homedir(), '.dsh');
}

/**
 * 获取 Agents 全局目录 (~/.agents 或 $AGENTS_HOME)
 */
export function getAgentsHomeDir(): string {
  const envAgentsHome = process.env.AGENTS_HOME;
  if (envAgentsHome && envAgentsHome.trim().length > 0) {
    return path.resolve(envAgentsHome);
  }
  return path.join(os.homedir(), '.agents');
}

/**
 * 解析全局指令文件状态与内容
 */
export function resolveGlobalInstructionFile(
  preference: GlobalFilePreference = 'auto',
  customDshHome?: string
): GlobalFileResolution {
  const dshHome = customDshHome ?? getDshHomeDir();
  const agentsPath = path.join(dshHome, 'AGENTS.md');
  const claudePath = path.join(dshHome, 'CLAUDE.md');

  const agentsExists = fs.existsSync(agentsPath);
  const claudeExists = fs.existsSync(claudePath);

  let targetPath = agentsPath;
  let alternatePath: string | undefined = claudePath;
  let activeFilename: 'AGENTS.md' | 'CLAUDE.md' = 'AGENTS.md';

  switch (preference as string) {
    case 'claude':
    case 'CLAUDE.md':
      targetPath = claudePath;
      alternatePath = agentsPath;
      activeFilename = 'CLAUDE.md';
      break;
    case 'agents':
    case 'AGENTS.md':
      targetPath = agentsPath;
      alternatePath = claudePath;
      activeFilename = 'AGENTS.md';
      break;
    case 'both':
    case 'auto':
    default:
      // 如果偏好为 auto：优先选择已存在的那个；若都存在，默认优先 CLAUDE.md 或 AGENTS.md
      if (claudeExists && !agentsExists) {
        targetPath = claudePath;
        alternatePath = agentsPath;
        activeFilename = 'CLAUDE.md';
      } else {
        targetPath = agentsPath;
        alternatePath = claudePath;
        activeFilename = 'AGENTS.md';
      }
      break;
  }

  const exists = fs.existsSync(targetPath);
  let content = '';
  let sizeBytes = 0;
  let lastModifiedMs = 0;

  if (exists) {
    try {
      const stats = fs.statSync(targetPath);
      content = fs.readFileSync(targetPath, 'utf-8');
      sizeBytes = stats.size;
      lastModifiedMs = stats.mtimeMs;
    } catch {
      // 容错读取失败
    }
  }

  return {
    primaryPath: targetPath,
    alternatePath,
    activeFilename,
    exists,
    content,
    sizeBytes,
    lastModifiedMs
  };
}

/**
 * 寻找工作区或项目根目录（通过向上探测 .git、package.json 等特征文件）
 */
export function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;
  // 家目录永远不是项目根：它是全局配置（~/.dsh、~/.agents）的所在，
  // 里面那份 CLAUDE.md 属于用户全局环境，不该被当成某个项目的指令加载。
  const homeDir = path.resolve(os.homedir());

  while (current && current !== root) {
    // 探测到 home 层就停，且 home 自身与更高层都不参与标志判定：
    // 家目录里的 .dsh、package.json 只是家目录配置，认下来会让所有
    // 无项目标志的子目录都被归到 home，进而误加载 ~/CLAUDE.md。
    if (current === homeDir) break;
    if (
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, 'package.json')) ||
      fs.existsSync(path.join(current, '.dsh'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 兜底：找不到项目标志时退回起点；但起点落在 home 时不能返回 home，
  // 否则从家目录启动仍会命中 ~/CLAUDE.md。返回 home 的上一级，等于宣告无项目根。
  const fallback = path.resolve(startDir);
  return fallback === homeDir ? path.dirname(homeDir) : fallback;
}

/**
 * 扫描并搜集从全局到项目的所有指令文件列表
 */
export function discoverInstructionFiles(
  workspaceDir: string,
  preference: GlobalFilePreference = 'auto',
  customDshHome?: string
): InstructionFileItem[] {
  const result: InstructionFileItem[] = [];

  // 1. 全局文件扫描
  const dshHome = customDshHome ?? getDshHomeDir();
  const agentsGlobal = path.join(dshHome, 'AGENTS.md');
  const claudeGlobal = path.join(dshHome, 'CLAUDE.md');

  if (preference === 'both') {
    if (fs.existsSync(agentsGlobal)) {
      result.push({
        path: agentsGlobal,
        displayPath: '~/.dsh/AGENTS.md',
        category: 'global',
        content: fs.readFileSync(agentsGlobal, 'utf-8')
      });
    }
    if (fs.existsSync(claudeGlobal)) {
      result.push({
        path: claudeGlobal,
        displayPath: '~/.dsh/CLAUDE.md',
        category: 'global',
        content: fs.readFileSync(claudeGlobal, 'utf-8')
      });
    }
  } else {
    const globalInfo = resolveGlobalInstructionFile(preference, dshHome);
    if (globalInfo.exists && globalInfo.content.trim().length > 0) {
      result.push({
        path: globalInfo.primaryPath,
        displayPath: `~/.dsh/${globalInfo.activeFilename}`,
        category: 'global',
        content: globalInfo.content
      });
    }
  }

  // 2. 项目与工作区扫描
  const projectRoot = findProjectRoot(workspaceDir);
  const candidates: Array<{ name: string; category: InstructionFileCategory; isProjectRoot: boolean }> = [
    { name: 'CLAUDE.md', category: 'project-claude', isProjectRoot: true },
    { name: 'CLAUDE.local.md', category: 'project-claude', isProjectRoot: true },
    { name: 'AGENTS.md', category: 'project-agents', isProjectRoot: true },
    { name: 'AGENTS.local.md', category: 'project-agents', isProjectRoot: true }
  ];

  // 项目根目录文件
  for (const item of candidates) {
    const filePath = path.join(projectRoot, item.name);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length > 0) {
          result.push({
            path: filePath,
            displayPath: item.name,
            category: item.category,
            content
          });
        }
      } catch {
        // 读取跳过
      }
    }
  }

  // 子目录扫描（如果当前工作区是项目根的深层子目录）
  const normalizedRoot = path.resolve(projectRoot);
  const normalizedCwd = path.resolve(workspaceDir);
  // 家目录本身不算任何项目的子目录：从家目录启动会命中兜底返回的
  // 「家目录的上一级」，若不排除，~/CLAUDE.md（全局环境记忆）会被当作
  // 子目录指令重新注入。
  if (
    normalizedCwd !== normalizedRoot &&
    normalizedCwd.startsWith(normalizedRoot) &&
    normalizedCwd !== path.resolve(os.homedir())
  ) {
    const subCandidates = ['CLAUDE.md', 'AGENTS.md'];
    for (const subName of subCandidates) {
      const subFilePath = path.join(normalizedCwd, subName);
      if (fs.existsSync(subFilePath)) {
        try {
          const content = fs.readFileSync(subFilePath, 'utf-8');
          if (content.trim().length > 0) {
            const relPath = path.relative(normalizedRoot, subFilePath).replace(/\\/g, '/');
            result.push({
              path: subFilePath,
              displayPath: relPath,
              category: 'subdirectory',
              content
            });
          }
        } catch {
          // 读取跳过
        }
      }
    }
  }

  return result;
}
