import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { validateManifest, checkCssScope, checkPageScript, loadSections, sectionOrder } from "../scripts/sections.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { pageOrder } from "../scripts/contracts.mjs";

const manifest = (id, extra = {}) => ({
  id, title: "测试栏目", consumes: [], params: { count: { type: "number", default: 3, min: 1, max: 5 } },
  rules: ["只用于测试"], image_policy: "free-only", narration: { lines: 6 }, state: null, ...extra,
});
const PAGE = `export function render(data, kit) {\n  return [\`\${kit.topBar("测试")}<h1 class="probe">\${data.text}</h1>\${kit.foot("测试栏目")}\`];\n}\n`;

function section(root, id, { m = manifest(id), js = PAGE, css = `#${id} .probe { color: red; }` } = {}) {
  const dir = join(root, "sections", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), typeof m === "string" ? m : JSON.stringify(m));
  if (js !== null) writeFileSync(join(dir, "page.js"), js);
  writeFileSync(join(dir, "page.css"), css);
}
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-sections-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };

test("validateManifest accepts a full manifest and names missing, mistyped and undeclared fields", () => {
  assert.deepEqual(validateManifest(manifest("fun-facts")), []);
  const { rules, ...noRules } = manifest("fun-facts");
  assert.match(validateManifest(noRules).join("\n"), /缺字段：rules/);
  assert.match(validateManifest(manifest("fun-facts", { colour: "red" })).join("\n"), /未声明的字段：colour/);
  assert.match(validateManifest(manifest("Fun_Facts")).join("\n"), /kebab-case/);
  assert.match(validateManifest(manifest("x", { consumes: "cover" })).join("\n"), /consumes/);
  assert.match(validateManifest(manifest("x", { image_policy: "any" })).join("\n"), /image_policy/);
  assert.match(validateManifest(manifest("x", { narration: { lines: 0 } })).join("\n"), /narration/);
  assert.match(validateManifest(manifest("x", { state: { file: "" } })).join("\n"), /state/);
  const bad = validateManifest(manifest("x", { params: { a: { type: "number", default: "3" }, b: { type: "string", default: "x", max: 2 }, c: { type: "date", default: 1 }, d: { type: "list", default: [], step: 1 } } })).join("\n");
  for (const re of [/params\.a\.default 必须是 number/, /params\.b\.max 只用于 number/, /params\.c\.type/, /params\.d 有未声明的字段：step/]) assert.match(bad, re);
  assert.match(validateManifest(manifest("x", { params: { n: { type: "number", default: 9, max: 5 } } })).join("\n"), /超出/);
  assert.match(validateManifest(manifest("x", { params: { s: { type: "string", default: "c", enum: ["a", "b"] } } })).join("\n"), /不在 enum/);
});

test("checkCssScope lists every selector that does not start with #<id>, inside @media too", () => {
  assert.deepEqual(checkCssScope("#quiz .a, #quiz > b { x: 1 } @keyframes k { from { x: 0 } } /* .c {} */", "quiz"), []);
  assert.deepEqual(checkCssScope(".card { x: 1 } #quiz .a, h1 { x: 1 } #quizzy { x: 1 } @media (max-width: 9px) { .b { x: 1 } #quiz .c { x: 1 } }", "quiz"), [".card", "h1", "#quizzy", ".b"]);
  assert.deepEqual(checkCssScope("#quiz :is(.a, .b) { x: 1 }", "quiz"), []);
});

test("checkPageScript requires a lone exported render and no imports", () => {
  assert.deepEqual(checkPageScript(PAGE), []);
  assert.match(checkPageScript(`import x from "y";\n${PAGE}`).join(), /import/);
  assert.match(checkPageScript("function render() {}").join(), /导出/);
  assert.match(checkPageScript(`${PAGE}export const x = 1;\n`).join(), /只导出 render/);
});

test("loadSections reads both repos, and rejects duplicates, overrides of engine ids and broken packages", t => {
  const engine = tmp(t), data = tmp(t);
  assert.deepEqual(loadSections({ engine, data }), { sections: [], errors: [] });
  section(engine, "fun-facts");
  section(data, "pet-diary");
  const ok = loadSections({ engine, data });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.sections.map(s => [s.id, s.origin]), [["fun-facts", "engine"], ["pet-diary", "data"]]);

  section(data, "fun-facts");
  section(data, "story");
  section(data, "c4");
  section(data, "no-script", { js: null });
  section(data, "loose-css", { css: ".probe { color: red; }" });
  section(data, "wrong-id", { m: manifest("other-id") });
  section(data, "bad-json", { m: "{" });
  section(data, "bad-manifest", { m: manifest("bad-manifest", { title: 3 }) });
  const { sections, errors } = loadSections({ engine, data }), all = errors.join("\n");
  assert.deepEqual(sections.map(s => s.id), ["fun-facts", "pet-diary"]);
  assert.match(all, /数据仓库 sections\/fun-facts：引擎里已有栏目「fun-facts」，数据仓库只能新增栏目，不能覆盖/);
  assert.match(all, /sections\/story：「story」是引擎的栏目/);
  assert.match(all, /sections\/c4：「c4」是引擎的栏目/);
  assert.match(all, /no-script：缺 page\.js/);
  assert.match(all, /loose-css\/page\.css：选择器要以 #loose-css 开头：\.probe/);
  assert.match(all, /wrong-id：manifest 的 id「other-id」要和目录名一致/);
  assert.match(all, /bad-json\/manifest\.json 不是合法 JSON/);
  assert.match(all, /bad-manifest\/manifest\.json：title/);

  const twin = tmp(t);
  section(twin, "fun-facts");
  section(twin, "fun-facts-2", { m: manifest("fun-facts-2") });
  assert.deepEqual(loadSections({ engine, data: twin }).errors.length, 1);
});

test("sectionOrder keeps the legacy order and puts new registered sections with data before the mailbox", () => {
  const issue = { cover: {}, comic: {}, story: {}, challenge: {}, mailbox: {}, "pet-diary": { text: "x" } };
  assert.deepEqual(sectionOrder(issue), ["cover", "comic", "story", "challenge", "mailbox"]);
  assert.deepEqual(sectionOrder(issue, [{ id: "pet-diary" }, { id: "fun-facts" }]), ["cover", "comic", "story", "challenge", "pet-diary", "mailbox"]);
});

const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
function demoIssue(t) {
  const root = tmp(t);
  cpSync(new URL("../examples/demo/", import.meta.url), root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  const issue = join(root, "issues/003"), p = createPipeline(issue);
  p.assemble();
  const fingerprint = p.fingerprint();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${fingerprint}\n`);
  const n = JSON.parse(readFileSync(join(issue, "narration.json"), "utf8"));
  n._meta.content_hash = fingerprint;
  writeFileSync(join(issue, "narration.json"), JSON.stringify(n));
  return { root, issue };
}
const render = (json, out, ...flags) => spawnSync(process.execPath, ["scripts/render.mjs", json, out, "--flat", ...flags], {
  cwd: new URL("../", import.meta.url), env: { ...process.env, CHROME: chrome }, encoding: "utf8", timeout: 60000,
});

test("rendering writes pages.json that matches the page order and the narration cards", { skip: !chrome, timeout: 90000 }, t => {
  const { issue } = demoIssue(t), out = join(issue, "cards");
  const r = render(join(issue, "issue.json"), out);
  assert.equal(r.status, 0, r.stderr);
  const pages = JSON.parse(readFileSync(join(out, "pages.json"), "utf8"));
  const data = JSON.parse(readFileSync(join(issue, "issue.json"), "utf8"));
  assert.deepEqual(pages.map(p => p.section), pageOrder(data));
  assert.deepEqual(pages.map(p => p.card), pages.map((_, i) => i + 1));
  assert.ok(pages.every(p => existsSync(join(out, `card-${p.card}.png`))));
  const narration = JSON.parse(readFileSync(join(issue, "narration.json"), "utf8")).narration;
  assert.deepEqual(narration.map(p => p.card), pages.map(p => p.card));
  assert.deepEqual(createPipeline(issue).check(), []);

  // pages.json 和本期栏目对不上（比如栏目变了没重新渲染），讲读稿检查要报出来
  writeFileSync(join(out, "pages.json"), JSON.stringify(pages.filter(p => p.section !== "news")));
  assert.match(createPipeline(issue).check().join("\n"), /\[render\].*pages\.json/);
});

test("a data-repo section renders through its page.js with scoped CSS and shows up in pages.json", { skip: !chrome, timeout: 90000 }, t => {
  const { root, issue } = demoIssue(t), out = join(root, "preview");
  section(root, "pet-diary");
  const data = JSON.parse(readFileSync(join(issue, "issue.json"), "utf8"));
  data["pet-diary"] = { text: "今天小乌龟晒了太阳" };
  const json = join(issue, "preview.json");
  writeFileSync(json, JSON.stringify(data));
  const r = render(json, out, "--preview");
  assert.equal(r.status, 0, r.stderr);
  const pages = JSON.parse(readFileSync(join(out, "pages.json"), "utf8"));
  assert.deepEqual(pages.map(p => p.section), [...pageOrder(data).slice(0, -1), "pet-diary", "mailbox"]);
  assert.deepEqual(pages.at(-2), { card: pages.length - 1, section: "pet-diary", id: "pet-diary" });
  const html = readFileSync(join(out, "issue.html"), "utf8");
  assert.match(html, /#pet-diary \.probe \{ color: red; \}/);
  // 页脚页码照常往后数：新栏目排在信箱前面，总页数算上它
  assert.ok(existsSync(join(out, `card-${pages.length}.png`)));

  section(root, "story");
  const bad = render(json, join(root, "bad"), "--preview");
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /栏目注册表有错[\s\S]*不能覆盖/);
});
