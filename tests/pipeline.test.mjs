import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { pageOrder, validateStructure } from "../scripts/contracts.mjs";

const demo = new URL("../examples/demo/", import.meta.url);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "kids-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(demo, root, { recursive: true });
  return join(root, "issues/003");
}
const json = (issue, name) => JSON.parse(readFileSync(join(issue, name), "utf8"));
const put = (issue, name, value) => writeFileSync(join(issue, name), JSON.stringify(value));

test("complete demo assembles and narration agrees with rendered page contract", t => {
  const issue = fixture(t), p = createPipeline(issue);
  assert.deepEqual(p.check(), []);
  p.assemble();
  assert.deepEqual(pageOrder(json(issue, "30-issue.json")), ["cover", "comic", "words", "story", "challenge", "news", "check", "serial", "mailbox"]);
  assert.equal(p.done("30-assemble"), true);
});

test("missing required stage blocks assembly without overwriting the previous issue", t => {
  const issue = fixture(t), before = readFileSync(join(issue, "30-issue.json"), "utf8");
  rmSync(join(issue, "17-news.json"));
  assert.throws(() => createPipeline(issue).assemble(), /17-news/);
  assert.equal(readFileSync(join(issue, "30-issue.json"), "utf8"), before);
});

test("wrong nested types and null are rejected before editorial checks", t => {
  const issue = fixture(t), story = json(issue, "13-story.json");
  story.paragraphs = "not an array";
  put(issue, "13-story.json", story);
  const p = createPipeline(issue);
  assert.equal(p.done("13-story"), false);
  assert.throws(() => p.assemble(), /paragraphs/);
  assert.ok(validateStructure("16-mailbox.json", { hello: null, send_note: "爸爸" }).length);
});

test("review needs an explicit passing conclusion; rejected review does not block reassembly", t => {
  const issue = fixture(t), p = createPipeline(issue);
  writeFileSync(join(issue, "31-review.md"), "结论：需修改\n示例：结论：通过\n");
  assert.equal(p.reviewPassed(), false);
  assert.equal(p.done("31-review"), false);
  assert.doesNotThrow(() => p.assemble());
  assert.ok(p.check().some(x => x.startsWith("[31]")));
  writeFileSync(join(issue, "31-review.md"), "结论：通过但仍需修改\n");
  assert.equal(p.reviewPassed(), false);
});

test("empty output directories and missing pages are not complete", t => {
  const issue = fixture(t), p = createPipeline(issue);
  mkdirSync(join(issue, "40-cards"), { recursive: true });
  mkdirSync(join(issue, "60-audio"), { recursive: true });
  mkdirSync(join(issue, "70-final"), { recursive: true });
  assert.equal(p.done("40-render"), false);
  assert.equal(p.done("60-audio"), false);
  assert.equal(p.done("70-video"), false);
  for (let i = 1; i <= 9; i++) writeFileSync(join(issue, `40-cards/card-${i}.png`), "image");
  writeFileSync(join(issue, "40-cards/小满早知道-第003期.pdf"), "pdf");
  assert.equal(p.done("40-render"), true);
  rmSync(join(issue, "40-cards/card-8.png"));
  assert.equal(p.done("40-render"), false);
});

test("audio completion requires every line in manifest and on disk", t => {
  const issue = fixture(t), p = createPipeline(issue), files = [];
  mkdirSync(join(issue, "60-audio"), { recursive: true });
  for (const page of json(issue, "50-narration.json").narration) page.lines.forEach((_, i) => {
    const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`;
    files.push({ card: page.card, index: i, file });
    writeFileSync(join(issue, "60-audio", file), "audio");
  });
  put(issue, "60-audio/manifest.json", { files });
  assert.equal(p.done("60-audio"), true);
  files.pop();
  put(issue, "60-audio/manifest.json", { files });
  assert.equal(p.done("60-audio"), false);
});

test("disabled weekly columns are not merged even if stale files remain", t => {
  const issue = fixture(t);
  put(issue, "09-creature.json", { invalid: true });
  put(issue, "08-think.json", { invalid: true });
  createPipeline(issue).assemble();
  assert.equal(json(issue, "30-issue.json").creature, undefined);
  assert.equal(json(issue, "30-issue.json").think, undefined);
});

test("duplicate or reordered narration cards fail validation", t => {
  const issue = fixture(t), narration = json(issue, "50-narration.json");
  narration.narration.push(narration.narration[0]);
  put(issue, "50-narration.json", narration);
  assert.ok(createPipeline(issue).check().some(x => x.includes("不可重复或遗漏")));
});

test("missing asset blocks assembly", t => {
  const issue = fixture(t);
  rmSync(join(issue, "20-assets/news-1.jpg"));
  assert.throws(() => createPipeline(issue).assemble(), /news-1.jpg/);
});

test("enabled weekly column is required; malformed JSON is not complete", t => {
  const issue = fixture(t), brief = json(issue, "00-brief.json");
  brief.creature = true;
  put(issue, "00-brief.json", brief);
  assert.throws(() => createPipeline(issue).assemble(), /09-creature/);
  writeFileSync(join(issue, "13-story.json"), "{broken");
  assert.equal(createPipeline(issue).done("13-story"), false);
});

test("archive receipt must refer to this issue and existing updated records", t => {
  const issue = fixture(t), p = createPipeline(issue);
  put(issue, "90-archive.json", { issue: 2, updated: ["story-bible.md"] });
  assert.equal(p.done("90-archive"), false);
  put(issue, "90-archive.json", { issue: 3, updated: ["story-bible.md"] });
  assert.equal(p.done("90-archive"), true);
  put(issue, "90-archive.json", { issue: 3, updated: ["missing.md"] });
  assert.equal(p.done("90-archive"), false);
});

test("official rendering rejects unapproved content before writing output", t => {
  const issue = fixture(t);
  writeFileSync(join(issue, "31-review.md"), "结论：需修改\n");
  const result = spawnSync(process.execPath, [new URL("../scripts/render.mjs", import.meta.url).pathname,
    join(issue, "30-issue.json"), join(issue, "40-cards"), "--flat"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /正式渲染需要/);
});
