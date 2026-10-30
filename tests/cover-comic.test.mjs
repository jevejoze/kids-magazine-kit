import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { ticket } from "../scripts/ticket.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { issueHtml, loadSections, validateManifest } from "../scripts/sections.mjs";

const engine = new URL("..", import.meta.url).pathname;
const demo = new URL("../examples/demo/", import.meta.url).pathname;
const copyDemo = t => {
  const root = mkdtempSync(join(tmpdir(), "kids-cover-comic-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const errors = (issue, tag) => createPipeline(issue).check().filter(e => e.startsWith(`[${tag}]`));

test("cover and comic register as packs", () => {
  const reg = loadSections({ engine }).sections;
  for (const id of ["cover", "comic"]) {
    const pack = reg.find(s => s.id === id);
    assert.ok(pack, id);
    assert.deepEqual(validateManifest(pack.manifest), [], id);
  }
});

test("cover pack checks the page and reports under step 10", t => {
  const { issue } = copyDemo(t), file = join(issue, "cover.json");
  assert.deepEqual(errors(issue, "cover"), []);
  edit(file, c => { c.question.zh = "长".repeat(30); c.crew = ["dog:happy:150", "owl:happy:150", "mouse:happy:150"]; c.crew_say = "长".repeat(13); });
  const e = errors(issue, "cover").join("\n");
  [/\[cover\] 问题 30 字，超过 24 字/, /\[cover\] 封面角色最多 2 个/, /\[cover\] crew_say 13 字，超过 12 字/].forEach(re => assert.match(e, re));
  edit(file, c => { delete c.photo.license; });
  assert.match(createPipeline(issue).check().join("\n"), /photo\.license 必须是非空 string/, "缺协议先由结构校验拦下");
  edit(file, c => { c.photo.license = "CC BY 4.0"; c.crew = ["cat:happy:150"]; });
  assert.match(errors(issue, "cover").join("\n"), /\[cover\] .*封面第 1 个角色/);
});

test("comic pack checks the page and its diagram under step 11", t => {
  const { issue } = copyDemo(t), file = join(issue, "comic.json");
  assert.deepEqual(errors(issue, "comic"), []);
  const c = json(file);
  writeFileSync(join(issue, c.diagram), '<svg viewBox="0 0 100 100"><text font-size="12">小</text><image href="https://example.org/a.png"/></svg>');
  edit(file, v => { v.panels = v.panels.slice(0, 3); });
  const e = errors(issue, "comic").join("\n");
  for (const re of [/\[comic\] 漫画要 4 格/, /\[comic\] 图解 SVG 必须设置 viewBox/, /\[comic\] 图解 SVG 不可引用外部网络图片/, /\[comic\] 图解 SVG 含过小字号 12px/]) assert.match(e, re);
  edit(file, v => { v.diagram = "missing.svg"; });
  assert.match(errors(issue, "comic").join("\n"), /\[comic\] 找不到非空图解 missing\.svg/);
});

test("changing the cover question makes the comic stale", t => {
  const { issue } = copyDemo(t);
  edit(join(issue, "comic.json"), c => { c._meta.ticket = ticket(issue, "comic").fingerprint; });
  assert.deepEqual(errors(issue, "comic"), []);
  edit(join(issue, "cover.json"), c => { c.question.zh = "换了一个问题？"; });
  assert.match(errors(issue, "comic").join("\n"), /\[comic\] 任务单变了/);
});

test("rendered issue has cover and comic from their packs", () => {
  const html = issueHtml({ data: json(join(demo, "issues", "003", "issue.json")) });
  for (const id of ["cover", "comic"]) assert.match(html, new RegExp(`SECTIONS\\["${id}"\\]`));
});
