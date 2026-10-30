// 讲读句数预算：全期 10–12 分钟、约 1800–2800 字是目标总长，不随页数变化；
// 页数比平时多（周一多怪物档案、周五多周末思辨，或开了单词屋/英文三关）时，
// 把每页的句数上限按比例收紧，总长才落在目标区间，不用每期分别调。
//   defaultMaxLines(kind, registry)      这一栏目包自己声明的句数上限（manifest.narration.lines）
//   scaledMaxLines(order, registry, {baseOverrides, paramsOverrides})   → { [kind]: 这一页最多几句 }
//     order：本期实际页序（kind 数组，如 ["cover","comic","creature","story",...]）
//     baseOverrides：缩放前先替换默认值（如启用英文三关时挑战页用 18 而不是包默认的 12）
//     paramsOverrides：任务书 sections.<kind>.params.narration_lines，写了就直接用这个数，不缩放
import { packFor } from "./sections.mjs";

// 现有栏目能凑出的最多页数：封面、今日一问、（传说怪物档案或周末思辨二选一）、单词屋、小剧场、
// 挑战、环球小报、真的假的、连载、信箱 = 10；页数不超过这个数就不缩放，留给以后加栏目的余量
export const BASELINE_PAGES = 10;
const FLOOR = 6;

export function defaultMaxLines(kind, registry) {
  return packFor(kind, registry, {})?.manifest.narration?.lines;
}

export function scaledMaxLines(order, registry, { baseOverrides = {}, paramsOverrides = {} } = {}) {
  const scale = Math.min(1, BASELINE_PAGES / Math.max(1, order.length));
  const out = {};
  for (const kind of order) {
    if (Number.isFinite(paramsOverrides[kind])) { out[kind] = paramsOverrides[kind]; continue; }
    const base = baseOverrides[kind] ?? defaultMaxLines(kind, registry) ?? 30;
    out[kind] = Math.max(FLOOR, Math.round(base * scale));
  }
  return out;
}
