import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { jsonDiff, compareIssue, renderError, issuesIn } from "../scripts/regress.mjs";

const regress = new URL("../scripts/regress.mjs", import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [regress, ...args], { encoding: "utf8", timeout: 240000 });

function data(t) {
  const root = mkdtempSync(join(tmpdir(), "kids-regress-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(new URL("../examples/demo/", import.meta.url), join(root, "data"), { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return root;
}

test("jsonDiff lists changed, added and removed paths", () => {
  assert.deepEqual(jsonDiff({ a: 1, b: [1, 2], c: { d: "x" } }, { a: 2, b: [1], c: {}, e: 0 }), ["a：值不同", "b：长度 2 → 1", "c.d：被删掉", "e：新增"]);
  assert.deepEqual(jsonDiff({ a: [1] }, { a: [1] }), []);
});

test("compareIssue reports pixel, card and JSON differences, and matches identical failures", () => {
  const base = { pixels: { "card-1.png": "a", "card-2.png": "b" }, issue: { x: 1 } };
  assert.deepEqual(compareIssue(base, structuredClone(base)), []);
  assert.deepEqual(compareIssue(base, { pixels: { "card-1.png": "z", "card-3.png": "c" }, issue: { x: 2 } }),
    ["card-1.png 像素不一致", "card-2.png 不见了", "card-3.png 是多出来的", "整期 JSON x：值不同"]);
  assert.deepEqual(compareIssue({ error: "Error: 坏图" }, { error: "Error: 坏图" }), []);
  assert.match(compareIssue({ error: "Error: 坏图" }, base)[0], /基线 失败，现在 成功/);
  assert.deepEqual(compareIssue({ pixels: null, issue: null }, base), ["基线里没有这一期"]);
});

test("renderError keeps the error message and drops Node's source excerpt and stack", () => {
  const stderr = "（--preview：以上问题只提示，照常渲染草稿）\nfile:///x/render.mjs:139\n  throw new Error(...)\n  ^\n\nError: 版面溢出，未发布成品：\ncard-4（#c5）：页脚超出底边 47px\n    at file:///x/render.mjs:139:9\n    at async y\n";
  assert.equal(renderError(stderr), "Error: 版面溢出，未发布成品：\ncard-4（#c5）：页脚超出底边 47px");
  assert.equal(renderError("只有一行\n"), "只有一行");
});

test("issuesIn picks three-digit issue directories that have a merged issue", t => {
  const root = data(t);
  assert.deepEqual(issuesIn(join(root, "data")), ["003"]);
});

test("regress refuses an output directory inside the engine repo outside output/", () => {
  const r = run("baseline", "examples/demo", new URL("../scripts/regress-out", import.meta.url).pathname);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /output\//);
  assert.equal(existsSync(new URL("../scripts/regress-out", import.meta.url)), false);
});

const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
test("baseline then compare matches; a changed issue is reported", { skip: !chrome || !ffmpeg }, t => {
  const root = data(t), dir = join(root, "data"), base = join(root, "base");
  const made = run("baseline", dir, base);
  assert.equal(made.status, 0, made.stdout + made.stderr);
  assert.match(made.stdout, /✅ 003 \d+ 张\n/);
  assert.ok(existsSync(join(base, "003/pixels.json")) && existsSync(join(base, "003/issue.json")));

  const same = run("compare", dir, base, join(root, "now"));
  assert.equal(same.status, 0, same.stdout + same.stderr);
  assert.match(same.stdout, /003 一致/);

  const issue = join(dir, "issues/003");
  for (const f of ["cover.json", "issue.json"]) {
    const j = JSON.parse(readFileSync(join(issue, f), "utf8"));
    j.question.zh = "换了一个封面问题？";
    writeFileSync(join(issue, f), JSON.stringify(j));
  }
  const changed = run("compare", dir, base, join(root, "changed"));
  assert.equal(changed.status, 1, changed.stdout + changed.stderr);
  assert.match(changed.stdout, /card-1\.png 像素不一致/);
  assert.match(changed.stdout, /整期 JSON question\.zh：值不同/);
});
