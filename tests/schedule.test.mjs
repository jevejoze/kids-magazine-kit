import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { parseYaml } from "../scripts/yaml.mjs";
import { DEFAULT_MAGAZINE, validateMagazine, loadMagazine, schedule, scheduleIssue, parseDate, curriculumWeek } from "../scripts/schedule.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";

const demo = new URL("../examples/demo/", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-schedule-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["40-cards", "60-audio", "70-final"].includes(basename(src)) });
  return root;
};
const demoMagazine = () => loadMagazine(demo);
const ids = (date, magazine = demoMagazine(), dataDir = demo) => Object.keys(schedule({ magazine, date, dataDir, issueNo: 3 }).sections);
const errorsOf = extra => validateMagazine({ ...parseYaml(readFileSync(join(demo, "magazine.yaml"), "utf8")), ...extra }).join("\n");

// 旧 stages.json：creature when mon、think when fri；words、english 是可选栏目，默认不做
test("default schedule matches the old when/optional sets on Monday, Friday and other days", () => {
  const base = ["cover", "comic", "story", "challenge", "news", "check", "serial", "mailbox"];
  const day = date => Object.keys(schedule({ magazine: DEFAULT_MAGAZINE, date, dataDir: tmpdir(), issueNo: 1 }).sections).sort();
  assert.deepEqual(day("2026-10-12"), [...base, "creature"].sort());
  assert.deepEqual(day("2026-10-16"), [...base, "think"].sort());
  for (const d of ["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-17", "2026-10-18"]) assert.deepEqual(day(d), [...base].sort(), d);
  assert.equal(schedule({ magazine: DEFAULT_MAGAZINE, date: "2026-10-14", dataDir: tmpdir(), issueNo: 1 }).weekday_theme, "世界各地");
});

test("demo magazine.yaml lists the optional sections and keeps render order", () => {
  assert.deepEqual(validateMagazine(parseYaml(readFileSync(join(demo, "magazine.yaml"), "utf8"))), []);
  assert.deepEqual(ids("2026.10.14 周三"), ["cover", "comic", "words", "story", "challenge", "english", "news", "check", "serial", "mailbox"]);
  const s = schedule({ magazine: demoMagazine(), date: "2026-10-14", dataDir: demo, issueNo: 3 }).sections;
  assert.equal(s.news.params.narration_lines, 26);
  assert.equal(s.challenge.params.narration_lines, 18, "英文三关并进挑战页，讲读句数放宽到 18");
  assert.equal(s.cover.params.narration_lines, 12);
  assert.equal(s.cover.params.image_policy, "private-ok");
  assert.equal(s.serial.params.kind, "book");
});

test("Friday serial follows the rotation, counting earlier non-book Fridays", t => {
  const root = tmp(t), magazine = DEFAULT_MAGAZINE;
  const kind = no => schedule({ magazine, date: "2026-10-16", dataDir: root, issueNo: no }).sections.serial.params.kind;
  assert.equal(kind(1), "make");
  const brief = (no, b) => { mkdirSync(join(root, "issues", no), { recursive: true }); writeFileSync(join(root, "issues", no, "00-brief.json"), JSON.stringify(b)); };
  brief("001", { sections: { serial: { params: { kind: "make" } } } });
  brief("002", { serial: { kind: "book" } });
  assert.equal(kind(5), "music");
  brief("003", { serial: { kind: "music" } });
  brief("004", { serial: { kind: "make" } });
  brief("005", { serial: { kind: "film" } });
  assert.equal(kind(6), "make", "四个一轮，第五次回到开头");
  assert.equal(kind(4), "make", "只数本期之前的期");
  assert.equal(schedule({ magazine, date: "2026-10-15", dataDir: root, issueNo: 6 }).sections.serial.params.kind, "book");
});

test("magazine.yaml validation names unknown sections, undeclared, scheduler-owned and out-of-range params", () => {
  assert.match(errorsOf({ sections: [...DEFAULT_MAGAZINE.sections, "fun-facts"] }), /未知栏目：fun-facts/);
  assert.match(errorsOf({ sections: DEFAULT_MAGAZINE.sections.filter(s => s !== "comic") }), /必须有这几页：comic/);
  assert.match(errorsOf({ sections: ["cover", "story", "comic", "challenge", "mailbox"] }), /旧版页面还不能调顺序/);
  assert.match(errorsOf({ colour: "red" }), /未知的配置项：colour/);
  assert.match(errorsOf({ params: { news: { headline_count: 2 } } }), /params\.news\.headline_count：栏目没有声明这个参数/);
  assert.match(errorsOf({ params: { serial: { kind: "film" } } }), /params\.serial\.kind：这个参数由调度填写/);
  assert.match(errorsOf({ params: { news: { narration_lines: 99 } } }), /params\.news\.narration_lines/);
  assert.match(errorsOf({ params: { news: { narration_lines: "多" } } }), /params\.news\.narration_lines/);
  assert.match(errorsOf({ params: { fun: { narration_lines: 3 } } }), /params\.fun：sections 里没有这个栏目/);
  assert.match(errorsOf({ image_policy: "free-only", params: { news: { image_policy: "private-ok" } } }), /不能放宽/);
  assert.match(errorsOf({ schedule: { days: { creature: ["monday"] } } }), /schedule\.days\.creature/);
  assert.match(errorsOf({ schedule: { friday: { news: ["make"] } } }), /周五轮换目前只开放 serial/);
  assert.match(errorsOf({ voices: { cat: { zh: "x" } } }), /voices/);
});

test("free-only magazine rejects a section pack that needs private images", t => {
  const root = tmp(t);
  const registry = [{ id: "fun-facts", manifest: { id: "fun-facts", params: {}, image_policy: "private-ok", narration: { lines: 6 } } }];
  const yaml = { image_policy: "free-only", sections: [...DEFAULT_MAGAZINE.sections.slice(0, -1), "fun-facts", "mailbox"] };
  assert.match(validateMagazine(yaml, registry).join("\n"), /栏目 fun-facts 要用新闻原图/);
  writeFileSync(join(root, "magazine.yaml"), "sections: [cover, comic]\n");
  assert.throws(() => loadMagazine(root), /magazine\.yaml 有问题：[\s\S]*必须有这几页/);
});

test("curriculum fills check and think params by week; defaults apply without the file", t => {
  const root = tmp(t);
  writeFileSync(join(root, "thinking-plan.md"), [
    "| 周 | 周一日期 | 本领 | 选项 `choices` | 查证工具 `tools` | 说法长什么样 | 周五接 |",
    "|---|---|---|---|---|---|---|",
    "| 1 | 2026-10-12 | 找证据 | 默认 | 来源、证据、别处怎么说 | 广告 | 守规则 |",
    "| 2 | 2026-10-19 | 事实还是观点 | 事实 / 观点 / 都有 | 能不能查 | 评论 | 玩笑和嘲笑 |",
  ].join("\n"));
  assert.deepEqual(curriculumWeek(join(root, "thinking-plan.md"), "2026-10-18"), { skill: "找证据", choices: "", tools: "来源、证据、别处怎么说", friday_topic: "守规则" });
  assert.equal(curriculumWeek(join(root, "thinking-plan.md"), "2026-10-11"), null);
  const fri = schedule({ magazine: DEFAULT_MAGAZINE, date: "2026-10-23", dataDir: root, issueNo: 9 }).sections;
  assert.deepEqual([fri.check.params.skill, fri.check.params.choices, fri.check.params.tools], ["事实还是观点", "事实 / 观点 / 都有", "能不能查"]);
  assert.deepEqual([fri.think.params.skill, fri.think.params.friday_topic], ["事实还是观点", "玩笑和嘲笑"]);
  const none = schedule({ magazine: DEFAULT_MAGAZINE, date: "2026-10-23", dataDir: tmp(t), issueNo: 9 }).sections;
  assert.deepEqual([none.check.params.skill, none.think.params.friday_topic], ["", ""]);
});

test("parseDate accepts both spellings and rejects a wrong weekday", () => {
  assert.deepEqual(parseDate("2026.10.14 周三"), { iso: "2026-10-14", weekday: "wed", time: Date.UTC(2026, 9, 14) });
  assert.equal(parseDate("2026-10-18").weekday, "sun");
  assert.throws(() => parseDate("2026.10.14 周四"), /日期和星期对不上，这天是三/);
  assert.throws(() => parseDate("2026-02-30"), /没有这一天/);
  assert.throws(() => parseDate("下周三"), /日期看不懂/);
});

test("schedule CLI writes the brief, and the demo still assembles to the same structure", t => {
  const root = copyDemo(t), issue = join(root, "issues", "003");
  const before = createPipeline(issue);
  before.assemble();
  const old = JSON.parse(readFileSync(join(issue, "30-issue.json"), "utf8"));
  const r = spawnSync(process.execPath, [new URL("../scripts/pipeline.mjs", import.meta.url).pathname, "schedule", issue], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2026\.10\.14 周三/);
  const brief = JSON.parse(readFileSync(join(issue, "00-brief.json"), "utf8"));
  assert.equal(brief.date, "2026.10.14 周三");
  assert.equal(brief.creature, false);
  assert.equal(brief.think, false);
  assert.deepEqual(Object.keys(brief.sections), ["cover", "comic", "words", "story", "challenge", "english", "news", "check", "serial", "mailbox"]);
  assert.equal(brief.masthead.zh, "小满早知道", "其余字段原样保留");
  const p = createPipeline(issue);
  assert.equal(p.done("00-brief"), true);
  p.assemble();
  const now = JSON.parse(readFileSync(join(issue, "30-issue.json"), "utf8"));
  const strip = o => { const { _meta, ...rest } = o; return rest; };
  assert.deepEqual(strip(now), strip(old));
});

test("a sections brief drops optional pages it leaves out and counts a Monday creature", t => {
  const root = copyDemo(t), issue = join(root, "issues", "003");
  writeFileSync(join(root, "magazine.yaml"), readFileSync(join(demo, "magazine.yaml"), "utf8").replace("  - words\n", "").replace("  - english\n", ""));
  scheduleIssue(issue);
  createPipeline(issue).assemble();
  const out = JSON.parse(readFileSync(join(issue, "30-issue.json"), "utf8"));
  assert.match(spawnSync(process.execPath, [new URL("../scripts/pipeline.mjs", import.meta.url).pathname, "status", issue], { encoding: "utf8" }).stdout, /➖ 09-creature .*本期不出/);
  assert.equal(out.words, undefined);
  assert.equal(out.challenge.english, undefined);
  const mon = scheduleIssue(issue, "2026-10-12");
  assert.equal(mon.creature, true);
  assert.equal(mon.date, "2026.10.12 周一");
  const status = spawnSync(process.execPath, [new URL("../scripts/pipeline.mjs", import.meta.url).pathname, "status", issue], { encoding: "utf8" }).stdout;
  assert.match(status, /👉 09-creature/);
  assert.match(status, /➖ 08-think .*本期不出/);
  assert.match(status, /现在可以做：09-creature/);
});

test("template magazine.yaml parses, validates and equals the engine defaults", () => {
  const file = new URL("../templates/data/magazine.yaml", import.meta.url).pathname;
  const m = parseYaml(readFileSync(file, "utf8"));
  assert.deepEqual(validateMagazine(m), []);
  for (const k of ["image_policy", "sections", "schedule", "curriculum"]) assert.deepEqual(m[k], DEFAULT_MAGAZINE[k], k);
});
