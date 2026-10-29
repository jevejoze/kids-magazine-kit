// 今日一问的按页校验：check(comic, ctx) → 问题列表（不带步骤前缀）
//   ctx.checkChar(spec, at) → 角色写法的问题列表；ctx.issue：本期目录，图解 SVG 相对它找
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED = ["title_zh", "title_en", "panels", "fact"];
const nonempty = f => existsSync(f) && statSync(f).isFile() && statSync(f).size > 0;

export function check(c, ctx = {}) {
  const problems = [];
  for (const k of REQUIRED) if (c[k] === undefined || c[k] === null || c[k] === "") problems.push(`缺少字段 ${k}`);
  if (c.panels?.length !== 4) problems.push("漫画要 4 格");
  c.panels?.forEach((p, i) => {
    if (p.bubbles.length > 2) problems.push(`第 ${i + 1} 格气泡 ${p.bubbles.length} 个，最多 2 个`);
    (p.chars ?? []).forEach(x => problems.push(...(ctx.checkChar?.(x, `第 ${i + 1} 格角色`) ?? [])));
  });
  const diagPath = c.diagram ? join(ctx.issue ?? ".", c.diagram) : "";
  if (!(c.diagram && nonempty(diagPath))) problems.push(`找不到非空图解 ${c.diagram}`);
  if (c.diagram && nonempty(diagPath) && String(c.diagram).endsWith(".svg")) {
    const svg = readFileSync(diagPath, "utf8");
    if (!/<svg\b[^>]*\bviewBox=["']0 0 880 300["']/.test(svg)) problems.push("图解 SVG 必须设置 viewBox=\"0 0 880 300\"");
    if (/<image\b[^>]*\b(?:href|xlink:href)=["']https?:/i.test(svg)) problems.push("图解 SVG 不可引用外部网络图片");
    const small = [...svg.matchAll(/font-size=["']?(\d+(?:\.\d+)?)/g)].map(m => Number(m[1])).find(sz => sz < 20);
    if (small) problems.push(`图解 SVG 含过小字号 ${small}px（要求中文标注 ≥ 24 号字）`);
  }
  return problems;
}
