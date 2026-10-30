import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { inputFingerprint, recordBuild, publishDirectory, currentBuild } from "../scripts/build-state.mjs";
import { pageOrder, validateStructure } from "../scripts/contracts.mjs";

const demo = new URL("../examples/demo/", import.meta.url);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "kids-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  const issue = join(root, "issues/003");
  const pipeline = createPipeline(issue);
  pipeline.assemble();
  const fingerprint = pipeline.fingerprint();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${fingerprint}\n`);
  const narration = json(issue, "narration.json");
  narration._meta.content_hash = fingerprint;
  put(issue, "narration.json", narration);
  return issue;
}
const json = (issue, name) => JSON.parse(readFileSync(join(issue, name), "utf8"));
function stamp(issue, stage, files) {
  recordBuild(issue, stage, inputFingerprint(issue, stage), files.map(f => join(issue, f)));
}
function cards(issue) {
  mkdirSync(join(issue, "cards"), { recursive: true });
  const names = [...Array.from({ length: 9 }, (_, i) => `cards/card-${i + 1}.png`), "cards/小满早知道-第003期.pdf"];
  for (const name of names) writeFileSync(join(issue, name), "generated");
  stamp(issue, "render", names);
}
const put = (issue, name, value) => writeFileSync(join(issue, name), JSON.stringify(value));

test("complete demo assembles and narration agrees with rendered page contract", t => {
  const issue = fixture(t), p = createPipeline(issue);
  assert.deepEqual(p.check(), []);
  p.assemble();
  assert.deepEqual(pageOrder(json(issue, "issue.json")), ["cover", "comic", "words", "story", "challenge", "news", "check", "serial", "mailbox"]);
  assert.equal(p.done("assemble"), true);
});

test("missing required stage blocks assembly without overwriting the previous issue", t => {
  const issue = fixture(t), before = readFileSync(join(issue, "issue.json"), "utf8");
  rmSync(join(issue, "news.json"));
  assert.throws(() => createPipeline(issue).assemble(), /news/);
  assert.equal(readFileSync(join(issue, "issue.json"), "utf8"), before);
});

test("wrong nested types and null are rejected before editorial checks", t => {
  const issue = fixture(t), story = json(issue, "story.json");
  story.paragraphs = "not an array";
  put(issue, "story.json", story);
  const p = createPipeline(issue);
  assert.equal(p.done("story"), false);
  assert.throws(() => p.assemble(), /paragraphs/);
  assert.ok(validateStructure("mailbox.json", { hello: null, send_note: "爸爸" }).length);
});

test("review needs an explicit passing conclusion; rejected review does not block reassembly", t => {
  const issue = fixture(t), p = createPipeline(issue);
  writeFileSync(join(issue, "review.md"), "结论：需修改\n示例：结论：通过\n");
  assert.equal(p.reviewPassed(), false);
  assert.equal(p.done("review"), false);
  assert.doesNotThrow(() => p.assemble());
  assert.ok(p.check().some(x => x.startsWith("[review]")));
  writeFileSync(join(issue, "review.md"), "结论：通过但仍需修改\n");
  assert.equal(p.reviewPassed(), false);
});

test("empty output directories and missing pages are not complete", t => {
  const issue = fixture(t), p = createPipeline(issue);
  mkdirSync(join(issue, "cards"), { recursive: true });
  mkdirSync(join(issue, "audio"), { recursive: true });
  mkdirSync(join(issue, "final"), { recursive: true });
  assert.equal(p.done("render"), false);
  assert.equal(p.done("audio"), false);
  assert.equal(p.done("video"), false);
  for (let i = 1; i <= 9; i++) writeFileSync(join(issue, `cards/card-${i}.png`), "image");
  writeFileSync(join(issue, "cards/小满早知道-第003期.pdf"), "pdf");
  stamp(issue, "render", [...Array.from({ length: 9 }, (_, i) => `cards/card-${i + 1}.png`), "cards/小满早知道-第003期.pdf"]);
  assert.equal(p.done("render"), true);
  rmSync(join(issue, "cards/card-8.png"));
  assert.equal(p.done("render"), false);
});

test("audio completion requires every line in manifest and on disk", t => {
  const issue = fixture(t), p = createPipeline(issue), files = [];
  mkdirSync(join(issue, "audio"), { recursive: true });
  for (const page of json(issue, "narration.json").narration) page.lines.forEach((_, i) => {
    const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`;
    files.push({ card: page.card, index: i, file });
    writeFileSync(join(issue, "audio", file), "audio");
  });
  put(issue, "audio/manifest.json", { files });
  stamp(issue, "audio", ["audio/manifest.json", ...files.map(f => "audio/" + f.file)]);
  assert.equal(p.done("audio"), true);
  files.pop();
  put(issue, "audio/manifest.json", { files });
  assert.equal(p.done("audio"), false);
});

test("with voicestudio.json, cloned lines must come from VoiceStudio", t => {
  const issue = fixture(t), p = createPipeline(issue), files = [];
  mkdirSync(join(issue, "../../voices"), { recursive: true });
  writeFileSync(join(issue, "../../voices/voicestudio.json"), JSON.stringify({ "narrator/zh": "parent" }));
  mkdirSync(join(issue, "audio"), { recursive: true });
  for (const page of json(issue, "narration.json").narration) page.lines.forEach((line, i) => {
    const file = `c${page.card}_${String(i).padStart(2, "0")}.wav`;
    files.push({ card: page.card, index: i, file, by: line.who === "narrator" && line.lang === "zh" ? "MiMo" : "Azure" });
    writeFileSync(join(issue, "audio", file), "audio");
  });
  const record = () => {
    put(issue, "audio/manifest.json", { files });
    stamp(issue, "audio", ["audio/manifest.json", ...files.map(f => "audio/" + f.file)]);
  };
  record();
  assert.equal(p.done("audio"), false);
  for (const f of files) if (f.by === "MiMo") f.by = "VoiceStudio-parent";
  record();
  assert.equal(p.done("audio"), true);
});

test("disabled weekly columns are not merged even if stale files remain", t => {
  const issue = fixture(t);
  put(issue, "creature.json", { invalid: true });
  put(issue, "think.json", { invalid: true });
  createPipeline(issue).assemble();
  assert.equal(json(issue, "issue.json").creature, undefined);
  assert.equal(json(issue, "issue.json").think, undefined);
});

test("duplicate or reordered narration cards fail validation", t => {
  const issue = fixture(t), narration = json(issue, "narration.json");
  narration.narration.push(narration.narration[0]);
  put(issue, "narration.json", narration);
  assert.ok(createPipeline(issue).check().some(x => x.includes("不可重复或遗漏")));
});

test("missing asset blocks assembly", t => {
  const issue = fixture(t);
  rmSync(join(issue, "assets/news-1.jpg"));
  assert.throws(() => createPipeline(issue).assemble(), /news-1.jpg/);
});

test("enabled weekly column is required; malformed JSON is not complete", t => {
  const issue = fixture(t), brief = json(issue, "brief.json");
  brief.creature = true;
  put(issue, "brief.json", brief);
  assert.throws(() => createPipeline(issue).assemble(), /creature/);
  writeFileSync(join(issue, "story.json"), "{broken");
  assert.equal(createPipeline(issue).done("story"), false);
});

test("archive receipt must refer to this issue and existing updated records", t => {
  const issue = fixture(t), p = createPipeline(issue);
  cards(issue);
  put(issue, "archive.json", { issue: 2, updated: ["state/story/open-threads.md"] });
  assert.equal(p.done("archive"), false);
  put(issue, "archive.json", { issue: 3, content_hash: p.fingerprint(), updated: ["state/story/open-threads.md"] });
  assert.equal(p.done("archive"), true);
  put(issue, "archive.json", { issue: 3, updated: ["missing.md"] });
  assert.equal(p.done("archive"), false);
});

test("official rendering rejects unapproved content before writing output", t => {
  const issue = fixture(t);
  writeFileSync(join(issue, "review.md"), "结论：需修改\n");
  const result = spawnSync(process.execPath, [new URL("../scripts/render.mjs", import.meta.url).pathname,
    join(issue, "issue.json"), join(issue, "cards"), "--flat"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /正式渲染需要/);
});

test("source edits invalidate assembly, review, narration and cards until each is redone", t => {
  const issue = fixture(t), p = createPipeline(issue);
  cards(issue);
  assert.equal(p.done("narration"), true);
  assert.equal(p.done("render"), true);
  const story = json(issue, "story.json");
  story.clue = "侦探笔记：窗台上少了什么？";
  put(issue, "story.json", story);
  for (const stage of ["assemble", "review", "narration", "render"]) assert.equal(p.done(stage), false, stage);
  p.assemble();
  assert.equal(p.done("assemble"), true);
  assert.equal(p.reviewPassed(), false);
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${p.fingerprint()}\n`);
  assert.equal(p.reviewPassed(), true);
  assert.equal(p.done("narration"), false);
  assert.equal(p.done("render"), false);
});

test("replacing image bytes under the same filename invalidates review", t => {
  const issue = fixture(t), p = createPipeline(issue);
  writeFileSync(join(issue, "assets/cover.jpg"), "replacement");
  assert.equal(p.done("assemble"), false);
  assert.equal(p.reviewPassed(), false);
});

test("modified output is stale even when all filenames are present", t => {
  const issue = fixture(t);
  cards(issue);
  writeFileSync(join(issue, "cards/card-1.png"), "modified image");
  assert.equal(createPipeline(issue).done("render"), false);
});

test("voice settings invalidate cached audio builds", t => {
  const issue = fixture(t);
  mkdirSync(join(issue, "audio"), { recursive: true });
  put(issue, "audio/manifest.json", { files: [] });
  stamp(issue, "audio", ["audio/manifest.json"]);
  assert.equal(currentBuild(issue, "audio"), true);
  mkdirSync(join(issue, "../../voices"), { recursive: true });
  writeFileSync(join(issue, "../../voices/azure.json"), '{"dog/zh":"different"}');
  assert.equal(currentBuild(issue, "audio"), false);
});

test("recording refuses inputs that changed during generation", t => {
  const issue = fixture(t), inputs = inputFingerprint(issue, "assemble");
  writeFileSync(join(issue, "assets/cover.jpg"), "replacement");
  assert.throws(() => recordBuild(issue, "assemble", inputs, [join(issue, "issue.json")]), /制作期间输入发生变化/);
});

test("publishing replaces obsolete generated files but preserves notes", t => {
  const issue = fixture(t), target = join(issue, "cards"), staging = join(issue, ".staging");
  mkdirSync(target, { recursive: true }); mkdirSync(staging);
  writeFileSync(join(target, "card-10.png"), "old");
  writeFileSync(join(target, "notes.md"), "keep");
  writeFileSync(join(staging, "card-1.png"), "new");
  publishDirectory(staging, target, name => /^card-\d+\.png$/.test(name));
  assert.deepEqual(readdirSync(target).sort(), ["card-1.png", "notes.md"]);
  assert.equal(readFileSync(join(target, "notes.md"), "utf8"), "keep");
});

test("Chrome failure preserves previous output and removes staging directories", t => {
  const issue = fixture(t), target = join(issue, "cards");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "card-1.png"), "previous");
  const result = spawnSync(process.execPath, [new URL("../scripts/render.mjs", import.meta.url).pathname,
    join(issue, "issue.json"), target, "--flat"], { encoding: "utf8", timeout: 15000, env: { ...process.env, CHROME: "/usr/bin/false" } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Chrome 退出/);
  assert.equal(readFileSync(join(target, "card-1.png"), "utf8"), "previous");
  assert.equal(readdirSync(issue).some(p => p.startsWith(".kids-render-")), false);
});

test("speech checkpoints survive interruption and resume without recharging saved lines", t => {
  const issue = fixture(t), mock = join(issue, "mock-azure.mjs"), log = join(issue, "calls.jsonl");
  writeFileSync(mock, `
    import { appendFileSync } from 'node:fs';
    const originalTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, ms === 3200 ? 0 : ms, ...args);
    let requests = 0;
    globalThis.fetch = async (_url, options) => {
      if (++requests === 2) throw new Error('simulated network interruption');
      appendFileSync(process.env.TEST_CALLS, JSON.stringify(options.body) + '\\n');
      const wav = Buffer.alloc(44 + 4800);
      wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
      wav.write('data', 36); wav.writeUInt32LE(4800, 40);
      return new Response(wav, { status: 200 });
    };
  `);
  const run = () => spawnSync(process.execPath, ["--import", mock, new URL("../scripts/tts_azure.mjs", import.meta.url).pathname, issue],
    { encoding: "utf8", timeout: 15000, env: { ...process.env, TEST_CALLS: log, AZURE_SPEECH_KEY: "offline-test", AZURE_SPEECH_REGION: "offline-test" } });
  const first = run();
  assert.match(first.stderr, /simulated network interruption/);
  assert.equal(json(issue, "audio/manifest.json").files.length, 1);
  assert.equal(json(issue, "audio/manifest.json")._meta.complete, false);
  assert.equal(existsSync(join(issue, "audio/build.json")), false);
  const saved = readFileSync(join(issue, "audio/c1_00.wav"));
  const second = run();
  assert.match(second.stderr, /simulated network interruption/);
  assert.equal(json(issue, "audio/manifest.json").files.length, 2);
  assert.deepEqual(readFileSync(join(issue, "audio/c1_00.wav")), saved);
  const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0], calls[1]);
});

test("speech dry runs leave no audio directories or receipts", t => {
  const issue = fixture(t);
  rmSync(join(issue, "audio"), { recursive: true, force: true });
  const result = spawnSync(process.execPath, [new URL("../scripts/tts_azure.mjs", import.meta.url).pathname, issue, "--dry"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(issue, "audio")), false);
});

test("a passing conclusion without a version cannot approve an old review", t => {
  const issue = fixture(t);
  writeFileSync(join(issue, "review.md"), "结论：通过\n");
  assert.equal(createPipeline(issue).reviewPassed(), false);
});

test("video provenance includes sound effects and every upstream output", t => {
  const issue = fixture(t), p = createPipeline(issue);
  cards(issue);
  mkdirSync(join(issue, "audio"), { recursive: true });
  const files = json(issue, "narration.json").narration.flatMap(page => page.lines.map((_, index) => {
    const file = `c${page.card}_${String(index).padStart(2, "0")}.wav`;
    writeFileSync(join(issue, "audio", file), "audio");
    return { card: page.card, index, file };
  }));
  put(issue, "audio/manifest.json", { files });
  stamp(issue, "audio", ["audio/manifest.json", ...files.map(f => "audio/" + f.file)]);
  mkdirSync(join(issue, "final"), { recursive: true });
  const outputs = ["final/讲读版.mp4", "final/小满早知道-第003期.pdf"];
  for (const name of outputs) writeFileSync(join(issue, name), "video output");
  stamp(issue, "video", outputs);
  assert.equal(p.done("video"), true);
  mkdirSync(join(issue, "../../sfx"), { recursive: true });
  writeFileSync(join(issue, "../../sfx/bgm.wav"), "new background music");
  assert.equal(p.done("video"), false);
});

test("Chinese narration rejects raw digits, percent signs, and thinking-plan spoilers", t => {
  const issue = fixture(t), narration = json(issue, "narration.json");
  narration.narration[0].lines[0].text = "今天有 7% 的概率下雨！";
  put(issue, "narration.json", narration);
  assert.ok(createPipeline(issue).check().some(x => x.includes("阿拉伯数字或 %")));
  narration.narration[0].lines[0].text = "今天练一项思维本领！";
  put(issue, "narration.json", narration);
  assert.ok(createPipeline(issue).check().some(x => x.includes("不得点破")));
});

test("diagram SVG viewBox and font size limits are enforced", t => {
  const issue = fixture(t);
  writeFileSync(join(issue, "diagram.svg"), '<svg viewBox="0 0 100 100"><text font-size="14">小字</text></svg>');
  const errors = createPipeline(issue).check();
  assert.ok(errors.some(x => x.includes("viewBox")));
  assert.ok(errors.some(x => x.includes("过小字号")));
});

test("parent script export and archive helper respect render freshness", t => {
  const issue = fixture(t), p = createPipeline(issue);
  assert.ok(readFileSync(p.script(), "utf8").includes("## 第 1 页 · 封面"));
  assert.deepEqual(readdirSync(join(issue, "final")), ["家长讲读稿.md"]);
  assert.throws(() => p.archive(), /第 40 步/);
  cards(issue);
  const r1 = p.archive(), pub = join(issue, "../../成品/003");
  assert.equal(r1.content_hash, p.fingerprint());
  assert.ok(r1.updated.includes("state/story/log.jsonl") && r1.updated.includes("state/story/open-threads.md") && r1.updated.includes("vocab.json"));
  assert.ok(existsSync(join(pub, "card-9.png")) && existsSync(join(pub, "小满早知道-第003期.pdf")));
  assert.equal(existsSync(join(pub, "小满早知道-第003期-讲读版.mp4")), false);
  assert.equal(p.done("archive"), false);
  const log = readFileSync(join(issue, "../../state/story/log.jsonl"), "utf8");
  assert.deepEqual(log.trim().split("\n").map(l => JSON.parse(l)), [{ issue: 3, ep: 3, title_zh: "珍珠的真相", summary: json(issue, "story.json").summary, secret: json(issue, "story.json").secret }]);
  assert.match(readFileSync(join(issue, "../../state/story/open-threads.md"), "utf8"), /- 半夜的吸溜声/);
  assert.deepEqual(p.archive(), r1);
  assert.equal(readFileSync(join(issue, "../../state/story/log.jsonl"), "utf8"), log, "重复归档不重复追加");
  put(issue, "archive.json", r1);
  assert.equal(p.done("archive"), true);
});

test("assembly carries tablet puzzle fields and drops stale mailbox answers", t => {
  const issue = fixture(t), m = json(issue, "mailbox.json");
  m.answers = "旧期遗留答案"; put(issue, "mailbox.json", m);
  createPipeline(issue).assemble();
  const data = json(issue, "issue.json");
  assert.deepEqual(data.challenge.puzzle.clues, json(issue, "challenge.json").clues);
  assert.equal(data.challenge.puzzle.question, json(issue, "challenge.json").question);
  assert.equal(data.mailbox.answers, undefined);
});

test("mailbox narration cannot bring back prior-issue answers", t => {
  const issue = fixture(t), narration = json(issue, "narration.json");
  narration.narration.at(-1).lines[0].text = "先公布上期答案。";
  put(issue, "narration.json", narration);
  assert.ok(createPipeline(issue).check().some(e => e.includes("信箱不再公布上期答案")));
});

test("source comic budgets block checking and assembly", t => {
  const issue = fixture(t), comic = json(issue, "comic.json");
  comic.panels[0].bubbles[0].text = "问".repeat(27);
  comic.panels[2].bubbles[0].text = "问".repeat(21);
  comic.takeaway = "答".repeat(29);
  comic.fact = "证".repeat(46);
  comic.panels[0].chars = ["dog:surprise:160"];
  put(issue, "comic.json", comic);
  const p = createPipeline(issue), errors = p.check().join("\n");
  for (const limit of [26, 20, 28, 45, 130]) assert.match(errors, new RegExp(String(limit)));
  assert.throws(() => p.assemble(), /comic/);
});

test("formal rendering rejects physical overflow and preserves previous output", { timeout: 60000 }, t => {
  const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  if (!chrome) return t.skip("Chrome unavailable");
  const issue = fixture(t), comic = json(issue, "comic.json");
  comic.title_zh = Array(20).fill("这是一行标题").join("<br>");
  put(issue, "comic.json", comic);
  const p = createPipeline(issue);
  p.assemble();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${p.fingerprint()}\n`);
  const target = join(issue, "previous-output");
  mkdirSync(target);
  writeFileSync(join(target, "card-2.png"), "previous image");
  const result = spawnSync(process.execPath, ["scripts/render.mjs", join(issue, "issue.json"), target, "--flat"], {
    cwd: new URL("../", import.meta.url), env: { ...process.env, CHROME: chrome }, encoding: "utf8", timeout: 45000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /版面溢出，未发布成品/);
  assert.equal(readFileSync(join(target, "card-2.png"), "utf8"), "previous image");
  assert.deepEqual(readdirSync(issue).filter(name => name.startsWith(".kids-render-")), []);
});

test("standard Chinese puzzle assembles without English dialogue or optional English stage", t => {
  const issue = fixture(t), puzzle = json(issue, "challenge.json");
  rmSync(join(issue, "english.json"));
  delete puzzle.taunt_en;
  put(issue, "challenge.json", puzzle);
  const pipeline = createPipeline(issue);
  assert.equal(pipeline.done("challenge"), true);
  pipeline.assemble();
  const data = json(issue, "issue.json");
  assert.equal(data.challenge.taunt_en, undefined);
  assert.equal(data.challenge.english, undefined);
  assert.equal(data._answers.english, undefined);
});

test("narration style rules catch stiff scripts", t => {
  const errors = edit => {
    const issue = fixture(t), narration = json(issue, "narration.json");
    edit(narration.narration, issue);
    put(issue, "narration.json", narration);
    return createPipeline(issue).check().filter(e => e.startsWith("[narration]"));
  };
  const has = (list, re) => assert.ok(list.some(e => re.test(e)), list.join("\n") || "no [narration] errors");
  // 1 cover, 2 comic, 3 words, 4 story, 5 challenge, 6 news, 7 check, 8 serial, 9 mailbox
  has(errors(p => { delete p[1].thread; }), /第 2 页缺 thread/);
  has(errors(p => { p[1].lines.find(l => l.who === "dog").text = "团子狗觉得太阳在加班。"; }), /说了自己的名字/);
  has(errors(p => { for (const l of p[1].lines) l.who = "narrator"; }), /第 2 页旁白 .*超过六成/);
  has(errors(p => { for (const page of p) for (const l of page.lines) if (l.lang === "zh") l.emotion = "平静"; }), /"平静"语气/);
  has(errors(p => { delete p[1].lines[0].emotion; }), /第 2 页第 1 句是中文却没写 emotion/);
  has(errors(p => { p[1].lines.splice(3, 0, { ...p[1].lines[2], who: "dog" }); }), /第 2 页第 3、4 句说了同一件事/);
  has(errors(p => { p[4].lines.push({ who: "raccoon", lang: "zh", text: "答案明天揭晓，哼！", emotion: "得意" }); }), /答案倒印在本页底部/);
  has(errors(p => { p[5].lines.find(l => l.lang === "en").text = "record"; }), /英文只有单词/);
  has(errors(p => { for (const page of p.slice(1, 4)) page.lines[0].text = "看完了，我们去下一页！"; }), /收尾式串词/);
  has(errors((p, issue) => {
    const items = json(issue, "news.json").items;
    p[5].lines.forEach((l, i) => { if (l.lang === "zh" && !l.pause) l.text = items[i % 3].text.slice(0, 30); });
  }), /第 6 页有 \d+ 句照着页面念/);
  const line = (who, text) => ({ who, lang: "zh", text, emotion: "开心" });
  has(errors(p => { p[1].lines.splice(2, 0, line("owl", "这块冰三十五克，那块冰三百四十克。")); }), /第 2 页有 \d+ 个数字/);
  has(errors(p => { p[0].lines.splice(1, 0, line("narrator", "这张照片是二零零九年拍的。")); }), /第 1 页念了年份或日期/);
  has(errors(p => { p[1].lines.splice(2, 0, line("owl", "哈，哪来的袜子。它脚上的血管会互相取暖。")); }), /照抄了 narration.md 的例句/);
  has(errors(p => { for (const l of p[5].lines) if (/help/i.test(l.text)) l.text = "What a big day!"; }), /没讲到关键词 help/);
  has(errors(p => { p[1].lines.push(line("dog", "那我先去睡一觉。"), line("owl", "去吧去吧。")); }), /"试试"后面还有 2 句/);
  has(errors(p => { p[8].lines.splice(1, 0, line("dog", "都说给爸爸听！")); }), /send_note 写的是/);
  has(errors(p => { p[8].lines.splice(1, 0, line("mouse", "明天见，这次又是谁呢？")); }), /重复了小剧场的 tbc/);
  has(errors(p => { p[1].lines.splice(2, 0, { who: "mouse", lang: "en", text: "The volcano is waking up!" }, line("dog", "记住了，大火山！")); }), /第 2 页第 3 句英文没走完来回/);
  has(errors(p => { p[3].lines.splice(1, 0, line("dog", "钥匙是开冰箱的吗？"), line("narrator", "桌上放着一把钥匙是开冰箱的。")); }), /第 4 页第 2 句先问了旁白后面才交代的事/);
  has(errors((p, issue) => { const who = json(issue, "serial.json").crew.who.split(":")[0]; p[7].lines = p[7].lines.filter(l => l.who !== who); }), /认领角色的吐槽/);
  has(errors(p => { p[8].lines.splice(1, 0, line("dog", "你猜，冰为什么会浮起来？")); }), /信箱不再出猜谜题/);
  has(errors(p => { p[0].lines.splice(1, 0, line("dog", "等等，等等！")); }), /全期"等等"出现 \d+ 次/);
  has(errors(p => { p[1].lines.splice(2, 0, line("dog", "fossil 就是化石！")); }), /团子狗台词解释了英文词/);
});
