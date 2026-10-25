#!/usr/bin/env node
// 第 20 步图片下载与裁剪工具（零外部 npm 依赖，使用内置 fetch + ffmpeg/ffprobe）
//
// 用法：
//   node scripts/assets.mjs fetch <url> <out.jpg|out.png> [--min 800] [--max 2000]
//   node scripts/assets.mjs trim  <in.png> <out.png> [--pad 20] [--white]
//   node scripts/assets.mjs slice <in.png> <out.png> <x:y:w:h> [--pad 8] [--white] [--erase x:y:w:h]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const UA = 'KidsMagazineKit/1.0 (https://github.com/jevejoze/kids-magazine-kit; educational-project)';

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function probeImage(file) {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,pix_fmt',
      '-of', 'json',
      file,
    ], { encoding: 'utf8' });
    const stream = JSON.parse(out).streams?.[0];
    if (!stream) return null;
    return {
      width: Number(stream.width),
      height: Number(stream.height),
      pix_fmt: stream.pix_fmt || '',
    };
  } catch {
    return null;
  }
}

function runCropDetect(file, detector, preFilter = '') {
  const vf = [preFilter, `${detector},cropdetect=limit=16:round=2:skip=0`].filter(Boolean).join(',');
  const res = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', vf, '-frames:v', '1', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const matches = [...(res.stderr || '').matchAll(/crop=(\d+:\d+:\d+:\d+)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

function getCropBox(file, useWhite, preFilter = '') {
  const info = probeImage(file);
  if (!info) die(`无法读取图片信息：${file}`);
  const hasAlpha = info.pix_fmt.includes('a');
  if (!useWhite && hasAlpha) {
    const crop = runCropDetect(file, 'alphaextract', preFilter);
    if (crop && crop !== `${info.width}:${info.height}:0:0`) {
      return { crop, hasAlpha: true, info };
    }
  }
  const crop = runCropDetect(file, 'negate', preFilter);
  if (!crop) die(`cropdetect 未检测到边界：${file}`);
  return { crop, hasAlpha: false, info };
}

async function cmdFetch(args) {
  const url = args[0];
  const out = args[1];
  if (!url || !out) die('用法：node scripts/assets.mjs fetch <url> <out> [--min 800] [--max 2000]');
  const minIdx = args.indexOf('--min');
  const minEdge = minIdx > -1 ? Number(args[minIdx + 1]) : 0;
  const maxIdx = args.indexOf('--max');
  const maxEdge = maxIdx > -1 ? Number(args[maxIdx + 1]) : 0;

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const tmp = `${out}.tmp`;

  let buf = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        die(`服务器返回了网页而非图片（${ct}），请检查缩略图尺寸是否为 1280/1920 等常用宽度`);
      }
      buf = Buffer.from(await res.arrayBuffer());
      break;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = attempt * 3000;
      console.warn(`  HTTP ${res.status}，等 ${wait / 1000}s 重试 (${attempt}/3)…`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    die(`下载失败 HTTP ${res.status}：${url}`);
  }

  fs.writeFileSync(tmp, buf);
  let info = probeImage(tmp);
  if (!info) {
    fs.unlinkSync(tmp);
    die(`下载的文件不是有效图片：${out}`);
  }

  const isJpg = /\.(jpe?g)$/i.test(out);
  const longEdge = Math.max(info.width, info.height);
  if (minEdge && longEdge < minEdge) {
    fs.unlinkSync(tmp);
    die(`图片长边 ${longEdge}px < 最低要求 ${minEdge}px (${info.width}x${info.height})`);
  }

  const needScale = maxEdge && longEdge > maxEdge;
  const needReencode = isJpg && (needScale || buf.length > 2 * 1024 * 1024);

  if (needReencode) {
    const vf = needScale
      ? ['-vf', `scale='if(gt(iw,ih),${maxEdge},-2)':'if(gt(iw,ih),-2,${maxEdge})'`]
      : [];
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', tmp, ...vf, '-q:v', '3', out]);
    fs.unlinkSync(tmp);
    info = probeImage(out);
  } else {
    fs.renameSync(tmp, out);
  }

  const sizeKB = Math.round(fs.statSync(out).size / 1024);
  console.log(`✓ ${out}  ${info.width}x${info.height}  ${sizeKB} KB`);
}

function cmdTrim(args) {
  const src = args[0];
  const out = args[1];
  if (!src || !out) die('用法：node scripts/assets.mjs trim <in.png> <out.png> [--pad 20] [--white]');
  const padIdx = args.indexOf('--pad');
  const pad = padIdx > -1 ? Number(args[padIdx + 1]) : 20;
  const useWhite = args.includes('--white');

  const { crop, hasAlpha } = getCropBox(src, useWhite);
  const padColor = (!useWhite && hasAlpha) ? 'white@0' : 'white';
  const vf = `crop=${crop},pad=iw+${pad * 2}:ih+${pad * 2}:${pad}:${pad}:color=${padColor}`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-vf', vf, out]);
  const info = probeImage(out);
  console.log(`✓ ${out}  crop=${crop}  pad=${pad}  -> ${info.width}x${info.height}`);
}

function cmdSlice(args) {
  const src = args[0];
  const out = args[1];
  const rect = args[2];
  if (!src || !out || !rect) {
    die('用法：node scripts/assets.mjs slice <in.png> <out.png> <x:y:w:h> [--pad 8] [--white] [--erase x:y:w:h]');
  }
  const [x, y, w, h] = rect.split(':').map(Number);
  if ([x, y, w, h].some(Number.isNaN)) die(`无效坐标 <x:y:w:h>：${rect}`);
  const padIdx = args.indexOf('--pad');
  const pad = padIdx > -1 ? Number(args[padIdx + 1]) : 8;
  const useWhite = args.includes('--white');
  const eraseIdx = args.indexOf('--erase');

  const filters = [`crop=${w}:${h}:${x}:${y}`];
  if (eraseIdx > -1 && args[eraseIdx + 1]) {
    const [ex, ey, ew, eh] = args[eraseIdx + 1].split(':').map(Number);
    const cond = `between(X,${ex},${ex + ew})*between(Y,${ey},${ey + eh})`;
    filters.push(`format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(${cond},0,alpha(X,Y))'`);
  }

  const preFilter = filters.join(',');
  const { crop, hasAlpha } = getCropBox(src, useWhite, preFilter);
  const padColor = (!useWhite && hasAlpha && !useWhite) ? 'white@0' : 'white';
  const fullVf = `${preFilter},crop=${crop},pad=iw+${pad * 2}:ih+${pad * 2}:${pad}:${pad}:color=${padColor}`;

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-vf', fullVf, out]);
  const info = probeImage(out);
  console.log(`✓ ${out}  cell=${w}:${h}:${x}:${y}  inner=${crop}  -> ${info.width}x${info.height}`);
}

const [, , cmd, ...rest] = process.argv;
if (cmd === 'fetch') {
  await cmdFetch(rest);
} else if (cmd === 'trim') {
  cmdTrim(rest);
} else if (cmd === 'slice') {
  cmdSlice(rest);
} else {
  console.log(`用法：
  node scripts/assets.mjs fetch <url> <out.jpg|out.png> [--min 800] [--max 2000]
  node scripts/assets.mjs trim  <in.png> <out.png> [--pad 20] [--white]
  node scripts/assets.mjs slice <in.png> <out.png> <x:y:w:h> [--pad 8] [--white] [--erase x:y:w:h]`);
  process.exit(cmd ? 1 : 0);
}
