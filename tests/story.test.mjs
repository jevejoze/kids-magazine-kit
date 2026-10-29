import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { ticket } from "../scripts/ticket.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { issueHtml } from "../scripts/sections.mjs";

const demo = new URL("../examples/demo/", import.meta.url).pathname;
const copyDemo = t => {
  const root = mkdtempSync(join(tmpdir(), "kids-story-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(demo, root, { recursive: true, filter: src => !["40-cards", "60-audio", "70-final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const storyErrors = issue => createPipeline(issue).check().filter(e => e.startsWith("[13]"));

test("story pack checks the page through its own check.mjs", t => {
  const { issue } = copyDemo(t), file = join(issue, "13-story.json");
  edit(file, s => { s._meta.ticket = ticket(issue, "story").fingerprint; });
  assert.deepEqual(storyErrors(issue), []);
  edit(file, s => { s.paragraphs.push("长".repeat(300)); s.scene[0] = "cat:happy:150"; });
  const errors = storyErrors(issue).join("\n");
  assert.match(errors, /\[13\] 故事 \d+ 字，超过 300/);
  assert.match(errors, /\[13\] .*scene\[0\]/);
  edit(file, s => { delete s.clue; });
  assert.match(createPipeline(issue).check().join("\n"), /clue 必须是非空 string/, "缺字段先由结构校验拦下");
});

test("with state/story the page must list open threads", t => {
  const { issue } = copyDemo(t), file = join(issue, "13-story.json");
  edit(file, s => { delete s.threads_after; });
  assert.match(storyErrors(issue).join("\n"), /缺少 threads_after/);
  edit(file, s => { s.threads_after = []; });
  assert.deepEqual(storyErrors(issue).filter(e => /threads_after/.test(e)), []);
});

test("a data dir without state/story keeps the old story-bible.md", t => {
  const { root, issue } = copyDemo(t);
  rmSync(join(root, "state"), { recursive: true });
  writeFileSync(join(root, "story-bible.md"), "# 连载圣经\n\n## 连载进度\n");
  assert.deepEqual(ticket(issue, "story").content.state, ["data/story-bible.md"]);
  edit(join(issue, "13-story.json"), s => { delete s.threads_after; });
  assert.deepEqual(storyErrors(issue).filter(e => /threads_after/.test(e)), [], "旧数据目录不要求 threads_after");
});

test("rendered issue has the story page from the pack", () => {
  const html = issueHtml({ data: json(join(demo, "issues", "003", "30-issue.json")) });
  assert.match(html, /SECTIONS\["story"\]/);
  assert.match(html, /"story"/);
});
