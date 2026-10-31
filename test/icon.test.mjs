/**
 * DSH 插件图标契约与规范自动化测试
 * 严格对齐 dsh-app-boot/lib/index.js 中 iconOf 与 MAX_ICON_BYTES 的约束
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MAX_ICON_BYTES = 256 * 1024; // 262,144 字节
const ALLOWED_MEDIA_TYPES = new Map([
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
]);

test('1. 图标清单声明：package.json icon 字段合法性', () => {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  assert.ok(typeof pkg.icon === 'string' && pkg.icon.trim().length > 0, 'package.json 必须包含非空 icon 字段');
  assert.ok(!path.isAbsolute(pkg.icon), 'icon 必须为相对路径');
  assert.ok(!/^[A-Za-z][A-Za-z\d+.-]*:/.test(pkg.icon), 'icon 严禁为绝对协议 URL');
  assert.ok(!pkg.icon.startsWith('..'), 'icon 严禁向上路径穿越');
  assert.ok(Array.isArray(pkg.files) && pkg.files.includes(pkg.icon), 'package.json files 白名单中必须包含该图标文件');
});

test('2. 图标文件物理属性与 DSH 256 KiB 大小上限检验', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const iconPath = path.join(rootDir, pkg.icon);

  assert.ok(fs.existsSync(iconPath), '图标文件必须实际存在于包根目录');
  const stat = fs.statSync(iconPath);
  assert.ok(stat.isFile(), '图标必须为普通文件');

  const ext = path.extname(iconPath).toLowerCase();
  assert.ok(ALLOWED_MEDIA_TYPES.has(ext), '图标扩展名必须属于 SVG/PNG/JPG/WEBP');

  const bytes = fs.readFileSync(iconPath);
  assert.ok(bytes.length <= MAX_ICON_BYTES, `图标字节数 (${bytes.length}B) 必须 <= ${MAX_ICON_BYTES}B (256 KiB)`);
});

test('3. 宿主 iconOf 行为模拟：成功生成可逆 Base64 Data URL', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const iconPath = path.join(rootDir, pkg.icon);
  const ext = path.extname(iconPath).toLowerCase();
  const mediaType = ALLOWED_MEDIA_TYPES.get(ext);
  const bytes = fs.readFileSync(iconPath);

  // 模拟 DSH 宿主 iconOf 核心生成逻辑
  const dataUrl = `data:${mediaType};base64,${bytes.toString('base64')}`;

  assert.ok(dataUrl.startsWith(`data:${mediaType};base64,`));
  const base64Part = dataUrl.slice(`data:${mediaType};base64,`.length);
  const decoded = Buffer.from(base64Part, 'base64');
  assert.equal(decoded.length, bytes.length);
  assert.ok(decoded.equals(bytes), '解码内容必须与源文件二进制完全一致');
});
