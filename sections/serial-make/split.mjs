// 折纸图式拆分：整张图式裁掉留白，再按格子一步切一张，放进 20-assets/serial-make/
//   node sections/serial-make/split.mjs <issue> <图式.png> <x:y:w:h> [<x:y:w:h> …] [--white] [--erase N=x:y:w:h]
//   格子坐标量在裁好的 diagram.png 上；不给格子只裁整张，先看裁好的图再量
//   split(issueDir, src, rects, { white, erase }) → { diagram, steps }，路径相对 20-assets/，照抄进 assets.json
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assetDir, trimImage, sliceImage } from "../../scripts/assets.mjs";

export const ID = "serial-make";

export function split(issueDir, src, rects = [], { white = false, erase = {} } = {}) {
  const dir = assetDir(issueDir, ID), rel = f => `${ID}/${f}`;
  const diagram = path.join(dir, "diagram.png");
  trimImage(src, diagram, { pad: 20, white });
  const steps = rects.map((rect, i) => {
    const f = `step-${i + 1}.png`;
    sliceImage(diagram, path.join(dir, f), rect, { pad: 8, white, erase: erase[i + 1] });
    return rel(f);
  });
  return { diagram: rel("diagram.png"), steps };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), white = args.includes("--white"), erase = {}, rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--white") continue;
    if (args[i] === "--erase") { const [n, r] = String(args[++i]).split("="); erase[Number(n)] = r; continue; }
    rest.push(args[i]);
  }
  const [issue, src, ...rects] = rest;
  if (!issue || !src) {
    console.error("用法：node sections/serial-make/split.mjs <issue> <图式.png> <x:y:w:h> … [--white] [--erase N=x:y:w:h]");
    process.exit(2);
  }
  try {
    const r = split(issue, src, rects, { white, erase });
    console.log(`✓ 整张图式 20-assets/${r.diagram}`);
    r.steps.forEach(f => console.log(`✓ 20-assets/${f}`));
    console.log(`assets.json：${JSON.stringify(r.steps.length ? { serial_steps: r.steps } : { serial_diagram: r.diagram })}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
