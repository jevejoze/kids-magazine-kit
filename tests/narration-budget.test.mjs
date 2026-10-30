import test from "node:test";
import assert from "node:assert/strict";
import { loadSections } from "../scripts/sections.mjs";
import { defaultMaxLines, scaledMaxLines, BASELINE_PAGES } from "../scripts/narration-budget.mjs";

const engine = new URL("..", import.meta.url).pathname;
const registry = () => loadSections({ engine }).sections;

test("defaultMaxLines reads each pack's own manifest.narration.lines", () => {
  const reg = registry();
  assert.equal(defaultMaxLines("challenge", reg), 12);
  assert.equal(defaultMaxLines("mailbox", reg), 10);
  assert.equal(defaultMaxLines("serial", reg), 20, "serial 没写 kind 时按 book 包取值");
});

test("today's heaviest real page count sits at the baseline, so no issue is ever squeezed", () => {
  // 周一或周五，再加单词屋、英文三关：封面、今日一问、(怪物档案/周末思辨)、单词屋、小剧场、挑战、环球小报、真的假的、连载、信箱
  assert.equal(BASELINE_PAGES, 10);
  const order = ["cover", "comic", "creature", "words", "story", "challenge", "news", "check", "serial", "mailbox"];
  assert.equal(order.length, BASELINE_PAGES);
  const reg = registry();
  const max = scaledMaxLines(order, reg);
  for (const kind of order) assert.equal(max[kind], defaultMaxLines(kind, reg), kind);
});

test("more pages than the baseline scale every page's limit down proportionally, with a floor", () => {
  const reg = registry();
  const order = ["cover", "comic", "creature", "words", "story", "challenge", "news", "check", "serial", "think", "mailbox", "story"];
  const max = scaledMaxLines(order, reg);
  const scale = BASELINE_PAGES / order.length;
  for (const kind of order) {
    const base = defaultMaxLines(kind, reg);
    assert.equal(max[kind], Math.max(6, Math.round(base * scale)), kind);
    assert.ok(max[kind] <= base, kind);
  }
});

test("baseOverrides replace the pack default before scaling (challenge with English three-level)", () => {
  const reg = registry();
  const order = ["cover", "comic", "creature", "words", "story", "challenge", "news", "check", "serial", "mailbox", "extra1", "extra2"];
  const withEnglish = scaledMaxLines(order, reg, { baseOverrides: { challenge: 18 } });
  const scale = BASELINE_PAGES / order.length;
  assert.equal(withEnglish.challenge, Math.max(6, Math.round(18 * scale)));
});

test("paramsOverrides (task-sheet narration_lines) are used verbatim, bypassing scaling", () => {
  const reg = registry();
  const order = Array.from({ length: 15 }, (_, i) => i === 0 ? "news" : `extra${i}`);
  const max = scaledMaxLines(order, reg, { paramsOverrides: { news: 24 } });
  assert.equal(max.news, 24, "任务书显式写的句数上限不受缩放影响");
});
