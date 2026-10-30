import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { ticket } from "../scripts/ticket.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { loadSections, validateManifest } from "../scripts/sections.mjs";
import { inputFingerprint, recordBuild } from "../scripts/build-state.mjs";
import { pageOrder } from "../scripts/contracts.mjs";

const engine = new URL("..", import.meta.url).pathname;
const demo = new URL("../examples/demo/", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-cct-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const registry = () => loadSections({ engine }).sections;

test("challenge, check and think register as section packs with valid manifests", () => {
  const reg = registry();
  for (const id of ["challenge", "check", "think"]) {
    const pack = reg.find(s => s.id === id);
    assert.ok(pack, id);
    assert.deepEqual(validateManifest(pack.manifest), [], id);
  }
});

test("check and think tickets carry the no-visible-pedagogy rule and the curriculum params", t => {
  const { issue } = copyDemo(t);
  const check = ticket(issue, "check");
  assert.ok(check.content.rules.some(r => r.id === "no-visible-pedagogy"), "check");
  assert.deepEqual(Object.keys(check.content.params).sort(), ["choices", "narration_lines", "skill", "tools"]);

  edit(join(issue, "brief.json"), b => { b.think = true; b.sections = { ...b.sections, think: { params: { skill: "", friday_topic: "" } } }; });
  const think = ticket(issue, "think");
  assert.ok(think.content.rules.some(r => r.id === "no-visible-pedagogy"), "think");
  assert.deepEqual(Object.keys(think.content.params).sort(), ["friday_topic", "narration_lines", "skill"]);
});

test("challenge ticket carries no extra rules", t => {
  const { issue } = copyDemo(t);
  const a = ticket(issue, "challenge");
  assert.deepEqual(a.content.rules.map(r => r.id), ["red-lines"]);
  assert.deepEqual(a.content.params, { narration_lines: 12 });
});

test("check pack's own check.mjs reports under [check]", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[check]"));
  assert.deepEqual(errors(), []);
  edit(join(issue, "check.json"), k => { k.claim = "说".repeat(31); });
  assert.ok(errors().some(e => e.includes("说法")), errors().join("\n"));
  edit(join(issue, "check.json"), k => { k.claim = "说法"; k.choices = ["真", "假"]; k.answer = "不在里面"; });
  assert.match(errors().join("\n"), /answer 要是 choices 里的一个/);
});

test("challenge pack's own check.mjs reports under [challenge]", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[challenge]"));
  assert.deepEqual(errors(), []);
  edit(join(issue, "challenge.json"), p => { p.taunt_zh = "字".repeat(25); });
  assert.ok(errors().some(e => e.includes("taunt_zh")), errors().join("\n"));
  edit(join(issue, "challenge.json"), p => { p.taunt_zh = "字".repeat(5); p.prop = "not-a-prop"; });
  assert.ok(errors().some(e => e.includes("道具不存在")), errors().join("\n"));
});

test("think pack's own check.mjs reports under [think]", t => {
  const { issue } = copyDemo(t);
  edit(join(issue, "brief.json"), b => { b.think = true; });
  writeFileSync(join(issue, "think.json"), JSON.stringify({
    _meta: { stage: "think", by: "测试" }, title: "话题", story: "故事",
    sides: [{ who: "dog:happy:120", say: "甲方观点" }, { who: "owl:think:120", say: "乙方观点" }],
    role: "换你来", deeper: ["追问一", "追问二"], parent_guide: "给家长的引导", source: "来源", log_update: "记一笔",
  }));
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[think]"));
  assert.deepEqual(errors(), []);
  edit(join(issue, "think.json"), t2 => { t2.sides = [t2.sides[0]]; });
  assert.ok(errors().some(e => e.includes("sides 要 2 个成员")), errors().join("\n"));
});

function rendered(issue) {
  const p = createPipeline(issue);
  p.assemble();
  const fingerprint = p.fingerprint();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${fingerprint}\n`);
  edit(join(issue, "narration.json"), n => { n._meta.content_hash = fingerprint; });
  mkdirSync(join(issue, "cards"), { recursive: true });
  const merged = json(join(issue, "issue.json"));
  const names = [...pageOrder(merged).map((_, i) => `cards/card-${i + 1}.png`), `cards/${merged.masthead.zh}-第003期.pdf`];
  for (const name of names) writeFileSync(join(issue, name), "generated");
  recordBuild(issue, "render", inputFingerprint(issue, "render"), names.map(f => join(issue, f)));
  return p;
}

test("archive appends to state/think/log.jsonl when it exists, else to think-log.md", t => {
  const legacy = copyDemo(t);
  edit(join(legacy.issue, "brief.json"), b => { b.think = true; });
  writeFileSync(join(legacy.issue, "think.json"), JSON.stringify({
    _meta: { stage: "think", by: "测试" }, title: "AI 写作业算谁的", story: "故事",
    sides: [{ who: "dog:happy:120", say: "甲方观点" }, { who: "owl:think:120", say: "乙方观点" }],
    role: "换你来", deeper: ["追问一", "追问二"], parent_guide: "给家长的引导", source: "来源", log_update: "2026-10-30 · AI 写作业算谁的",
  }));
  const r1 = rendered(legacy.issue).archive();
  assert.ok(r1.updated.includes("think-log.md"));
  assert.match(readFileSync(join(legacy.root, "think-log.md"), "utf8"), /第 003 期（.*）：.*AI 写作业算谁的/);

  const { root, issue } = copyDemo(t);
  edit(join(issue, "brief.json"), b => { b.think = true; });
  writeFileSync(join(issue, "think.json"), JSON.stringify({
    _meta: { stage: "think", by: "测试" }, title: "AI 写作业算谁的", story: "故事",
    sides: [{ who: "dog:happy:120", say: "甲方观点" }, { who: "owl:think:120", say: "乙方观点" }],
    role: "换你来", deeper: ["追问一", "追问二"], parent_guide: "给家长的引导", source: "来源", log_update: "2026-10-30 · AI 写作业算谁的",
  }));
  mkdirSync(join(root, "state", "think"), { recursive: true });
  const before = existsSync(join(root, "think-log.md")) ? readFileSync(join(root, "think-log.md"), "utf8") : "";
  const p = rendered(issue), r2 = p.archive();
  assert.ok(r2.updated.includes("state/think/log.jsonl"));
  const log = readFileSync(join(root, "state", "think", "log.jsonl"), "utf8");
  assert.deepEqual(log.trim().split("\n").map(l => JSON.parse(l)), [{ issue: 3, date: json(join(issue, "brief.json")).date, title: "AI 写作业算谁的", summary: "2026-10-30 · AI 写作业算谁的" }]);
  assert.equal(existsSync(join(root, "think-log.md")) ? readFileSync(join(root, "think-log.md"), "utf8") : "", before, "新目录不再写 think-log.md");
  p.archive();
  assert.equal(readFileSync(join(root, "state", "think", "log.jsonl"), "utf8"), log, "重复归档不重复追加");
});

test("buildIssue falls back to the curriculum's choices/tools when check.json leaves them out", t => {
  const { issue, root } = copyDemo(t);
  edit(join(issue, "check.json"), k => { delete k.choices; delete k.tools; delete k.skill; });
  edit(join(issue, "brief.json"), b => { b.sections = { ...b.sections, check: { params: { skill: "事实还是观点", choices: "📏 事实 / 💭 观点 / 🧩 都有", tools: "能量出来吗？/ 换个人会变吗？/ 哪个词露馅了？" } } }; });
  const merged = createPipeline(issue).buildIssue();
  assert.deepEqual(merged.check.choices, ["📏 事实", "💭 观点", "🧩 都有"]);
  assert.deepEqual(merged.check.tools, [["能量出来吗？", ""], ["换个人会变吗？", ""], ["哪个词露馅了？", ""]]);
  assert.equal(merged._answers.check.skill, "事实还是观点");

  // 本期自己写了 choices/tools 就不用参数兜底
  edit(join(issue, "check.json"), k => { k.choices = ["✅ 真的", "❌ 假的"]; k.answer = "✅ 真的"; });
  const merged2 = createPipeline(issue).buildIssue();
  assert.deepEqual(merged2.check.choices, ["✅ 真的", "❌ 假的"]);
  void root;
});
