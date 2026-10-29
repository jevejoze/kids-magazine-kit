import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { ticket, validateCast, loadCast } from "../scripts/ticket.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";

const engine = new URL("..", import.meta.url).pathname;
const demo = new URL("../examples/demo/", import.meta.url).pathname;
const cli = new URL("../scripts/pipeline.mjs", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-ticket-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["40-cards", "60-audio", "70-final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const fp = (issue, skill, opts) => ticket(issue, skill, opts).fingerprint;
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

test("ticket fingerprint is stable and names rules, cast slots, params, state, upstream values and outputs", t => {
  const { issue } = copyDemo(t);
  const a = ticket(issue, "story"), b = ticket(issue, "13-story");
  assert.equal(a.fingerprint, b.fingerprint, "栏目 id 和步骤 id 领到同一张任务单");
  assert.equal(fp(issue, "story"), a.fingerprint);
  assert.match(a.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(a.content.rules.map(r => r.id), ["red-lines"]);
  assert.equal(a.content.cast.slots.trickster, "raccoon");
  assert.equal(a.content.brief.story.ep, 3);
  assert.deepEqual(a.content.state, ["data/state/story/config.md", "data/state/story/log.jsonl", "data/state/story/open-threads.md"]);
  assert.deepEqual(a.content.output, ["issue/13-story.json"]);
  assert.equal(a.content.params.narration_lines, 30);
  assert.deepEqual(ticket(issue, "news").content.rules.map(r => r.id), ["red-lines", "images", "english-level"]);
  assert.deepEqual(ticket(issue, "narration").content.rules.map(r => r.id), ["red-lines", "narration", "no-visible-pedagogy"]);
  assert.equal(ticket(issue, "50-narration").fingerprint, fp(issue, "narration"));
  assert.match(ticket(issue, "comic").content.consumes["cover.question"].en, /midnight/);
  assert.match(a.markdown, /指纹：[a-f0-9]{64}，写进输出的 _meta\.ticket$/);
});

test("fingerprint changes with the brief, params, a rule file, the cast and a consumed value", t => {
  const { root, issue } = copyDemo(t);
  const base = { story: fp(issue, "story"), comic: fp(issue, "comic"), cover: fp(issue, "cover") };
  edit(join(issue, "00-brief.json"), b => { b.weather = "🌧️ 小雨"; });
  assert.equal(fp(issue, "story"), base.story, "任务单不收的字段不影响指纹");
  edit(join(issue, "00-brief.json"), b => { b.story.plan = "换个结尾"; });
  assert.notEqual(fp(issue, "story"), base.story, "任务书");
  assert.equal(fp(issue, "cover"), base.cover, "别的栏目的任务书块不影响封面");
  edit(join(issue, "00-brief.json"), b => { b.sections = { cover: { params: { narration_lines: 9 } }, comic: { params: {} }, story: { params: {} }, challenge: { params: {} }, mailbox: { params: {} } }; });
  assert.notEqual(fp(issue, "cover"), base.cover, "参数");

  const eng = tmp(t);
  cpSync(join(engine, "core"), join(eng, "core"), { recursive: true });
  cpSync(join(engine, "cast"), join(eng, "cast"), { recursive: true });
  const before = fp(issue, "story", { engine: eng });
  appendFileSync(join(eng, "core", "rules", "red-lines.md"), "- 新加一条\n");
  assert.notEqual(fp(issue, "story", { engine: eng }), before, "规则文件");

  const story = fp(issue, "story");
  mkdirSync(join(root, "cast"));
  const cast = json(join(engine, "cast", "default.json"));
  cast.slots.asker = "mouse";
  writeFileSync(join(root, "cast", "default.json"), JSON.stringify(cast));
  assert.notEqual(fp(issue, "story"), story, "数据目录的 cast 覆盖引擎的");

  const comic = fp(issue, "comic");
  edit(join(issue, "10-cover.json"), c => { c.question.zh = "换一个问题？"; });
  assert.notEqual(fp(issue, "comic"), comic, "上游值");
});

test("red-lines stays in the ticket when a section pack declares no rules; unknown rules and skipped sections error", t => {
  const { root, issue } = copyDemo(t);
  const dir = join(root, "sections", "fun-facts");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ id: "fun-facts", title: "冷知识", consumes: ["cover.question"], params: { count: { type: "number", default: 3, min: 1, max: 5 } }, rules: [], image_policy: "free-only", narration: { lines: 6 }, state: null }));
  writeFileSync(join(dir, "page.js"), "export function render(data, kit) { return [`<h1>${data.text}</h1>`]; }\n");
  writeFileSync(join(dir, "page.css"), "");
  const tk = ticket(issue, "fun-facts");
  assert.deepEqual(tk.content.rules.map(r => r.id), ["red-lines"]);
  assert.deepEqual(tk.content.output, ["issue/fun-facts.json"]);
  assert.deepEqual(tk.content.params, { count: 3, narration_lines: 6 });
  assert.ok(tk.content.consumes["cover.question"]);
  edit(join(dir, "manifest.json"), m => { m.rules = ["no-such-rule"]; });
  assert.throws(() => ticket(issue, "fun-facts"), /声明的规则不存在：no-such-rule/);
  edit(join(issue, "00-brief.json"), b => { b.sections = { cover: { params: {} } }; });
  assert.throws(() => ticket(issue, "story"), /本期不出/);
  assert.throws(() => ticket(issue, "20-assets"), /不属于哪个栏目/);
  assert.throws(() => ticket(issue, "nope"), /没有这个栏目/);
});

test("a cast needs two characters and every slot filled by a known character", t => {
  const base = json(join(engine, "cast", "default.json"));
  assert.deepEqual(validateCast(base), []);
  assert.match(validateCast({ ...base, characters: { dog: base.characters.dog } }).join("\n"), /至少要 2 个角色/);
  const { trickster, ...four } = base.slots;
  assert.match(validateCast({ ...base, slots: four }).join("\n"), /槽位 trickster 没人担/);
  assert.match(validateCast({ ...base, slots: { ...base.slots, expert: "cat" } }).join("\n"), /expert 填的 cat 不在 characters/);
  assert.deepEqual(validateCast({ characters: { a: { name: "甲" }, b: { name: "乙" } }, slots: { asker: "a", expert: "b", english: "b", trickster: "a", narrator: "a" } }), [], "一个角色可以兼几个槽位");

  const { root, issue } = copyDemo(t);
  mkdirSync(join(root, "cast"));
  writeFileSync(join(root, "cast", "duo.json"), JSON.stringify({ characters: { dog: base.characters.dog }, slots: base.slots }));
  assert.throws(() => loadCast(root, "duo"), /cast 包「duo」有问题[\s\S]*至少要 2 个角色/);
  assert.throws(() => loadCast(root, "missing"), /找不到 cast 包「missing」/);
  writeFileSync(join(root, "magazine.yaml"), readFileSync(join(root, "magazine.yaml"), "utf8") + "cast: duo\n");
  assert.throws(() => ticket(issue, "story"), /至少要 2 个角色/);
});

test("status and check mark an output stale when its _meta.ticket no longer matches", t => {
  const { issue } = copyDemo(t);
  const story = join(issue, "13-story.json");
  edit(story, s => { s._meta.ticket = fp(issue, "story"); });
  const p = createPipeline(issue);
  assert.equal(p.done("13-story"), true);
  assert.deepEqual(p.check().filter(e => /任务单/.test(e)), []);
  edit(join(issue, "00-brief.json"), b => { b.story.plan = "换个结尾"; });
  assert.equal(p.done("13-story"), false);
  assert.match(p.check().join("\n"), /\[13\] 任务单变了，输出已过期，请按新任务单重做/);
  assert.match(run("status", issue).stdout, /👉 13-story .*（未完成、输出无效或已过期）/);
  assert.throws(() => p.assemble(), /任务单变了/);
  edit(story, s => { s._meta.ticket = fp(issue, "story"); });
  assert.equal(p.done("13-story"), true, "按新任务单重做后恢复");
});

test("ticket CLI prints the ticket and asks for a skill", t => {
  const { issue } = copyDemo(t);
  const r = run("ticket", issue, "story");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /# 任务单 · story（第 13 步）/);
  assert.match(r.stdout, /## 规则 · red-lines/);
  assert.match(r.stdout, /trickster：捣蛋浣熊/);
  assert.ok(r.stdout.trim().endsWith(`指纹：${fp(issue, "story")}，写进输出的 _meta.ticket`));
  assert.notEqual(run("ticket", issue).status, 0);
  const bad = run("ticket", issue, "nope");
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /没有这个栏目/);
});
