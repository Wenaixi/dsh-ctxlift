/**
 * DSH Workspace Instructions Granular Render and Truncation Engine
 */

import { Buffer } from 'node:buffer';
import type {
  FilePolicyConfig,
  GranularInstructionsConfig,
  TruncateDirection
} from '../config.js';

export type InstructionFileCategory = 'global' | 'project-claude' | 'project-agents' | 'subdirectory';

export interface InstructionFileItem {
  /** 文件完整路径或标准路径标识（如 ~/.dsh/AGENTS.md, /repo/CLAUDE.md） */
  path: string;
  /** 用于展示给大模型的引用标识（如 ~/.dsh/AGENTS.md, CLAUDE.md） */
  displayPath: string;
  /** 文件归属分类，用于匹配独立策略 */
  category: InstructionFileCategory;
  /** 文本全文内容 */
  content: string;
}

export interface TruncatedFileResult {
  path: string;
  displayPath: string;
  category: InstructionFileCategory;
  originalBytes: number;
  renderedBytes: number;
  isTruncated: boolean;
  content: string;
}

export interface RenderResult {
  files: TruncatedFileResult[];
  fullPromptText: string;
  totalBytes: number;
}

/**
 * UTF-8 字符边界安全的字节截断函数
 * 支持从尾部截断 (tail, 保留头部) 或从头部截断 (head, 保留尾部)
 */
export function truncateUtf8Safe(
  text: string,
  maxBytes: number,
  direction: TruncateDirection = 'tail',
  notice?: string
): { text: string; isTruncated: boolean } {
  if (maxBytes <= 0) {
    return { text: '', isTruncated: text.length > 0 };
  }

  const rawBuffer = Buffer.from(text, 'utf-8');
  if (rawBuffer.byteLength <= maxBytes) {
    return { text, isTruncated: false };
  }

  const noticeText = notice ? `\n${notice}\n` : '';
  const noticeBuffer = Buffer.from(noticeText, 'utf-8');
  const allowedBytes = Math.max(0, maxBytes - noticeBuffer.byteLength);

  if (allowedBytes === 0) {
    return { text: noticeText.trim(), isTruncated: true };
  }

  if (direction === 'tail') {
    // 保留头部，截断尾部：取前 allowedBytes 字节
    let cutEnd = allowedBytes;

    // 回退 UTF-8 续字节，避免乱码
    // UTF-8 续字节的二进制特征为 10xxxxxx (0x80 ~ 0xBF)
    // 多字节起始字节：110xxxxx (2字节), 1110xxxx (3字节), 11110xxx (4字节)
    while (cutEnd > 0 && (rawBuffer[cutEnd]! & 0xc0) === 0x80) {
      cutEnd -= 1;
    }
    // 如果命中多字节起始字节但截断后长度不够，则必须退回起始字节前
    if (cutEnd > 0) {
      const lead = rawBuffer[cutEnd - 1]!;
      if ((lead & 0xe0) === 0xc0 && cutEnd - 1 + 2 > allowedBytes) cutEnd -= 1;
      else if ((lead & 0xf0) === 0xe0 && cutEnd - 1 + 3 > allowedBytes) cutEnd -= 1;
      else if ((lead & 0xf8) === 0xf0 && cutEnd - 1 + 4 > allowedBytes) cutEnd -= 1;
    }

    // 寻找最近的自然换行符，尽量保证行完整
    const candidateBuf = rawBuffer.subarray(0, cutEnd);
    const lastNewline = candidateBuf.lastIndexOf(0x0a);
    const safeCut = lastNewline > Math.floor(allowedBytes * 0.7) ? lastNewline : cutEnd;

    const truncatedSlice = rawBuffer.subarray(0, safeCut).toString('utf-8');
    const finalText = noticeText ? `${truncatedSlice.trimEnd()}${noticeText}` : truncatedSlice;
    return { text: finalText, isTruncated: true };
  } else {
    // 保留尾部，截断头部：取后 allowedBytes 字节
    let cutStart = rawBuffer.byteLength - allowedBytes;

    // 前移至合法的 UTF-8 字符起始位置
    while (cutStart < rawBuffer.byteLength && (rawBuffer[cutStart]! & 0xc0) === 0x80) {
      cutStart += 1;
    }

    // 寻找最近的自然换行符
    const nextNewline = rawBuffer.indexOf(0x0a, cutStart);
    const safeStart = (nextNewline !== -1 && nextNewline < cutStart + Math.floor(allowedBytes * 0.3))
      ? nextNewline + 1
      : cutStart;

    const truncatedSlice = rawBuffer.subarray(safeStart).toString('utf-8');
    const prefixNotice = notice ? `${notice}\n\n` : '';
    const finalText = `${prefixNotice}${truncatedSlice.trimStart()}`;
    return { text: finalText, isTruncated: true };
  }
}

/**
 * 根据独立文件规则处理单个文件
 */
export function processFileWithPolicy(
  file: InstructionFileItem,
  policy: FilePolicyConfig,
  noticePolicy: 'compact' | 'silent'
): TruncatedFileResult | null {
  if (policy.mode === 'disabled') {
    return null;
  }

  const rawBytes = Buffer.byteLength(file.content, 'utf-8');

  if (policy.mode === 'unlimited') {
    return {
      path: file.path,
      displayPath: file.displayPath,
      category: file.category,
      originalBytes: rawBytes,
      renderedBytes: rawBytes,
      isTruncated: false,
      content: file.content
    };
  }

  const maxBytes = policy.maxBytes ?? 65536;
  if (rawBytes <= maxBytes) {
    return {
      path: file.path,
      displayPath: file.displayPath,
      category: file.category,
      originalBytes: rawBytes,
      renderedBytes: rawBytes,
      isTruncated: false,
      content: file.content
    };
  }

  const notice = noticePolicy === 'compact'
    ? `[Workspace instruction truncated: showing ${policy.truncateFrom === 'head' ? 'latest' : 'first'} bytes within ${maxBytes} byte budget]`
    : undefined;

  const { text, isTruncated } = truncateUtf8Safe(
    file.content,
    maxBytes,
    policy.truncateFrom ?? 'tail',
    notice
  );

  return {
    path: file.path,
    displayPath: file.displayPath,
    category: file.category,
    originalBytes: rawBytes,
    renderedBytes: Buffer.byteLength(text, 'utf-8'),
    isTruncated,
    content: text
  };
}

/**
 * 格式化输出为 DSH 原生兼容的 <system-reminder> 结构
 */
export function renderGranularInstructionSet(
  files: InstructionFileItem[],
  config: GranularInstructionsConfig
): RenderResult {
  const getPolicy = (category: InstructionFileCategory): FilePolicyConfig => {
    switch (category) {
      case 'global':
        return config.globalPolicy;
      case 'project-claude':
        return config.projectClaudePolicy;
      case 'project-agents':
        return config.projectAgentsPolicy;
      case 'subdirectory':
        return config.subdirectoriesPolicy;
    }
  };

  const processedList: TruncatedFileResult[] = [];

  for (const file of files) {
    const policy = getPolicy(file.category);
    const result = processFileWithPolicy(file, policy, config.noticePolicy);
    if (result && result.content.trim().length > 0) {
      processedList.push(result);
    }
  }

  if (processedList.length === 0) {
    return {
      files: [],
      fullPromptText: '',
      totalBytes: 0
    };
  }

  // 拼接模板与官方格式严格保持一致
  const sections = processedList.map((f) => {
    return `Instructions from: ${f.displayPath}\n\n${f.content.trim()}`;
  });

  const fullPromptText = [
    '<system-reminder>',
    'The following workspace instructions may be relevant to your work. Use them as guidance when applicable. More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.',
    '',
    sections.join('\n\n'),
    '</system-reminder>'
  ].join('\n');

  return {
    files: processedList,
    fullPromptText,
    totalBytes: Buffer.byteLength(fullPromptText, 'utf-8')
  };
}
