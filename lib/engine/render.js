/**
 * DSH 工作区指令渲染与 UTF-8 安全截断引擎
 */
import { Buffer } from 'node:buffer';
/** 截断时附加的提示文案 */
const TRUNCATE_NOTICE = '[Workspace instruction truncated: showing first bytes within byte budget]';
/**
 * 按 UTF-8 字符边界安全截断，避免切断多字节字符产生乱码
 * 当前固定保留开头、截断尾部；如需头部优先可在此扩展
 */
export function truncateUtf8Safe(text, maxBytes, notice) {
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
    // 保留开头、截断尾部：先取前 allowedBytes 字节，再回退到合法字符边界
    let cutEnd = allowedBytes;
    // UTF-8 续字节的二进制特征为 10xxxxxx（0x80 到 0xBF），跳过它们可回到字符起点
    while (cutEnd > 0 && (rawBuffer[cutEnd] & 0xc0) === 0x80) {
        cutEnd -= 1;
    }
    // 多字节起始字节：110xxxxx（2字节）、1110xxxx（3字节）、11110xxx（4字节）
    // 若起始字节被切开且剩余长度不足以补全整个字符，则退回起始字节之前
    if (cutEnd > 0) {
        const lead = rawBuffer[cutEnd - 1];
        if ((lead & 0xe0) === 0xc0 && cutEnd - 1 + 2 > allowedBytes)
            cutEnd -= 1;
        else if ((lead & 0xf0) === 0xe0 && cutEnd - 1 + 3 > allowedBytes)
            cutEnd -= 1;
        else if ((lead & 0xf8) === 0xf0 && cutEnd - 1 + 4 > allowedBytes)
            cutEnd -= 1;
    }
    // 尽量在完整行边界截断：最近的换行符位置若处于后 30% 区间则使用它
    const candidateBuf = rawBuffer.subarray(0, cutEnd);
    const lastNewline = candidateBuf.lastIndexOf(0x0a);
    const safeCut = lastNewline > Math.floor(allowedBytes * 0.7) ? lastNewline : cutEnd;
    const truncatedSlice = rawBuffer.subarray(0, safeCut).toString('utf-8');
    const finalText = noticeText ? `${truncatedSlice.trimEnd()}${noticeText}` : truncatedSlice;
    return { text: finalText, isTruncated: true };
}
/**
 * 按单层策略处理一个指令文件
 */
export function processFileWithPolicy(file, policy) {
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
    const { text, isTruncated } = truncateUtf8Safe(file.content, maxBytes, TRUNCATE_NOTICE);
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
 * 拼接渲染为 DSH 原生兼容的 system-reminder 结构
 */
export function renderGranularInstructionSet(files, config) {
    const getPolicy = (category) => {
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
    const processedList = [];
    for (const file of files) {
        const policy = getPolicy(file.category);
        const result = processFileWithPolicy(file, policy);
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
//# sourceMappingURL=render.js.map