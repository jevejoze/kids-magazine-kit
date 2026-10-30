import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { loadSections, validateManifest } from "../scripts/sections.mjs";

const engine = new URL("..", import.meta.url).pathname;
const demo = new URL("../examples/demo/", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-mwe-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const registry = () => loadSections({ engine }).sections;

test("mailbox, words and english register as section packs with valid manifests", () => {
  const reg = registry();
  for (const id of ["mailbox", "words", "english"]) {
    const pack = reg.find(s => s.id === id);
    assert.ok(pack, id);
    assert.deepEqual(validateManifest(pack.manifest), [], id);
  }
});

test("buildIssue takes mailbox's send_note from the brief (magazine.yaml), not from mailbox.json", t => {
  const { issue } = copyDemo(t);
  edit(join(issue, "mailbox.json"), m => { m.send_note = "写在任务单里的旧值，不该被用到"; });
  edit(join(issue, "brief.json"), b => { b.send_note = "拍照发给爷爷"; });
  const merged = createPipeline(issue).buildIssue();
  assert.equal(merged.mailbox.send_note, "拍照发给爷爷");
});

test("mailbox's own check.mjs no longer requires send_note", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[mailbox]"));
  assert.deepEqual(errors(), []);
  edit(join(issue, "mailbox.json"), m => { delete m.send_note; });
  assert.deepEqual(errors(), [], "send_note 不再是必填字段");
  edit(join(issue, "mailbox.json"), m => { m.hello = "字".repeat(61); });
  assert.ok(errors().some(e => e.includes("开头问候")), errors().join("\n"));
});

test("words pack's own check.mjs flags a word already learned in an earlier issue", t => {
  const { root, issue } = copyDemo(t);
  writeFileSync(join(root, "vocab.json"), JSON.stringify([{ word: "midnight", issue: 1 }]));
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[words]"));
  assert.ok(errors().some(e => e.includes("已经在第 1 期学过")), errors().join("\n"));
});

test("english pack's own check.mjs flags an over-length level and a bad prop", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[english]"));
  assert.deepEqual(errors(), []);
  edit(join(issue, "english.json"), e => { e.english[0].en = Array.from({ length: 50 }, () => "word").join(" "); });
  assert.ok(errors().some(e => e.includes("超过 45")), errors().join("\n"));
  edit(join(issue, "english.json"), e => { e.english[0].en = "short"; e.prop = "not-a-prop"; });
  assert.ok(errors().some(e => e.includes("道具不存在")), errors().join("\n"));
});
