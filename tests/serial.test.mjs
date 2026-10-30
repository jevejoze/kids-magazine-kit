import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { ticket } from "../scripts/ticket.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { loadSections, packFor, validateManifest } from "../scripts/sections.mjs";
import { validateMagazine } from "../scripts/schedule.mjs";
import { parseYaml } from "../scripts/yaml.mjs";
import { assetDir } from "../scripts/assets.mjs";
import { inputFingerprint, recordBuild } from "../scripts/build-state.mjs";
import { split } from "../sections/serial-make/split.mjs";

const engine = new URL("..", import.meta.url).pathname;
const demo = new URL("../examples/demo/", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-serial-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const registry = () => loadSections({ engine }).sections;
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const origami = {
  _meta: { stage: "serial", by: "测试" }, kind: "make", craft: "origami",
  title_zh: "折一只小船", title_en: "Paper Boat", by: "传统折纸",
  paragraphs: ["一张纸折成船。"], tasks: ["对折", "再对折"], crew: { who: "dog:happy:150", say: "能漂起来吗？" },
  where: "家里", diagram_url: "https://example.org/boat.png", diagram_credit: "示例", diagram_steps: 2,
};

test("the four serial packs register on the serial slot and each kind finds its own pack", () => {
  const reg = registry();
  for (const kind of ["book", "music", "film", "make"]) {
    const pack = packFor("serial", reg, { serial: { kind } });
    assert.equal(pack?.id, `serial-${kind}`, kind);
    assert.deepEqual(validateManifest(pack.manifest), [], kind);
  }
  assert.equal(packFor("serial", reg, { serial: {} }).id, "serial-book", "没写 kind 算 book");
  assert.equal(packFor("serial", reg, { serial: { kind: "dance" } }), undefined);
  assert.match(validateManifest({ ...packFor("serial", reg).manifest, slot: { key: "serial" } }).join("\n"), /slot 要写成/);
});

test("a second pack for the same slot kind is a registry error", t => {
  const { root } = copyDemo(t);
  const dir = join(root, "sections", "serial-book-2");
  cpSync(join(engine, "sections", "serial-book"), dir, { recursive: true });
  edit(join(dir, "manifest.json"), m => { m.id = "serial-book-2"; });
  assert.match(loadSections({ engine, data: root }).errors.join("\n"), /页位 serial 的 kind「book」已经有栏目包了/);
});

test("serial tickets go to the pack of this issue's kind", t => {
  const { root, issue } = copyDemo(t);
  const a = ticket(issue, "serial");
  assert.equal(a.content.skill, "serial-book");
  assert.equal(a.fingerprint, ticket(issue, "serial").fingerprint);
  assert.equal(a.fingerprint, ticket(issue, "serial-book").fingerprint);
  assert.equal(a.content.params.kind, "book");
  assert.equal(a.content.params.narration_lines, 20);
  assert.deepEqual(a.content.state, ["data/serial-bible.md"], "还没建 state/serial-book/ 就沿用 serial-bible.md");
  assert.throws(() => ticket(issue, "serial-make"), /本期 kind 是 book，该领 serial-book 的任务单，不是 serial-make/);

  mkdirSync(join(root, "state", "serial-book"), { recursive: true });
  assert.deepEqual(ticket(issue, "serial").content.state, ["data/state/serial-book/config.md", "data/state/serial-book/log.jsonl"]);

  edit(join(issue, "brief.json"), b => { b.sections = { ...b.sections, serial: { params: { kind: "make" } } }; });
  const m = ticket(issue, "serial");
  assert.equal(m.content.skill, "serial-make");
  assert.equal(m.content.stage, "serial");
  assert.deepEqual(m.content.rules.map(r => r.id), ["red-lines", "images", "english-level"]);
  assert.equal(ticket(issue, "serial-make").fingerprint, m.fingerprint);
});

test("check hands each kind's fields to its pack", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[serial]"));
  assert.deepEqual(errors(), []);
  writeFileSync(join(issue, "serial.json"), JSON.stringify({ ...origami, diagram_url: undefined }));
  assert.ok(errors().includes("[serial] 缺少字段 diagram_url"), errors().join("\n"));
  writeFileSync(join(issue, "serial.json"), JSON.stringify({ ...origami, tasks: ["对折"] }));
  assert.match(errors().join("\n"), /每一步图配一句话：图式 2 步，tasks 1 句/);
  const book = json(join(demo, "issues", "003", "serial.json"));
  delete book.guess;
  writeFileSync(join(issue, "serial.json"), JSON.stringify(book));
  assert.match(errors().join("\n"), /guess/, "book 包管 book 的字段");
});

test("a free-only magazine cannot rotate a private-ok serial pack in on Fridays", () => {
  const base = parseYaml(readFileSync(join(demo, "magazine.yaml"), "utf8"));
  const reg = registry();
  const free = { ...base, image_policy: "free-only", params: undefined };
  delete free.params;
  const errs = validateMagazine({ ...free, schedule: { ...base.schedule, friday: { serial: ["make"] } } }, reg).join("\n");
  assert.match(errs, /栏目包 serial-make（serial 的 make）.*free-only/);
  assert.doesNotMatch(validateMagazine({ ...free, schedule: { ...base.schedule, friday: { serial: [] } } }, reg).join("\n"), /栏目包 serial-/);
});

test("pack assets live in assets/<pack id>/", { skip: !hasFfmpeg && "没有 ffmpeg" }, t => {
  const { issue } = copyDemo(t);
  assert.equal(assetDir(issue, "serial-make"), join(issue, "assets", "serial-make"));
  const src = join(tmp(t), "diagram.png");
  const r0 = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=white:s=400x200", "-vf", "drawbox=x=40:y=40:w=120:h=100:color=black:t=fill,drawbox=x=200:y=40:w=160:h=100:color=black:t=fill", "-frames:v", "1", src]);
  assert.equal(r0.status, 0, String(r0.stderr));
  const r = split(issue, src, ["0:0:130:110", "150:0:170:110"]);
  assert.deepEqual(r, { diagram: "serial-make/diagram.png", steps: ["serial-make/step-1.png", "serial-make/step-2.png"] });
  for (const f of [r.diagram, ...r.steps]) assert.ok(existsSync(join(issue, "assets", f)), f);
});

function rendered(issue) {
  const p = createPipeline(issue);
  p.assemble();
  const fingerprint = p.fingerprint();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${fingerprint}\n`);
  edit(join(issue, "narration.json"), n => { n._meta.content_hash = fingerprint; });
  mkdirSync(join(issue, "cards"), { recursive: true });
  const names = [...Array.from({ length: 9 }, (_, i) => `cards/card-${i + 1}.png`), "cards/小满早知道-第003期.pdf"];
  for (const name of names) writeFileSync(join(issue, name), "generated");
  recordBuild(issue, "render", inputFingerprint(issue, "render"), names.map(f => join(issue, f)));
  return p;
}

test("archive appends to state/serial-<kind>/log.jsonl when it exists, else to serial-bible.md", t => {
  const legacy = copyDemo(t);
  const r1 = rendered(legacy.issue).archive();
  assert.ok(r1.updated.includes("serial-bible.md"));
  assert.match(readFileSync(join(legacy.root, "serial-bible.md"), "utf8"), /第 003 期（.*）：示例第 1 回/);

  const { root, issue } = copyDemo(t);
  mkdirSync(join(root, "state", "serial-book"), { recursive: true });
  const before = readFileSync(join(root, "serial-bible.md"), "utf8");
  const p = rendered(issue), r2 = p.archive();
  assert.ok(r2.updated.includes("state/serial-book/log.jsonl"));
  const log = readFileSync(join(root, "state", "serial-book", "log.jsonl"), "utf8");
  assert.deepEqual(log.trim().split("\n").map(l => JSON.parse(l)), [{ issue: 3, date: json(join(issue, "brief.json")).date, kind: "book", ep: 1, title_zh: "一只看表的兔子", summary: "示例第 1 回：爱丽丝追着看表的白兔掉进洞里。" }]);
  assert.equal(readFileSync(join(root, "serial-bible.md"), "utf8"), before, "新目录不再写 serial-bible.md");
  p.archive();
  assert.equal(readFileSync(join(root, "state", "serial-book", "log.jsonl"), "utf8"), log, "重复归档不重复追加");
});
