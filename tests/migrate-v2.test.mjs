import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = new URL("../scripts/migrate-v2.mjs", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-migrate-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });

// 一个合成的、带旧数字前缀命名的数据目录，不含任何真实孩子数据
function syntheticRepo(root) {
  mkdirSync(join(root, "issues", "007"), { recursive: true });
  mkdirSync(join(root, "issues", "legacy"), { recursive: true });
  mkdirSync(join(root, "voices"), { recursive: true });
  const issue = join(root, "issues", "007");
  writeFileSync(join(issue, "00-brief.json"), JSON.stringify({ issue: 7 }));
  writeFileSync(join(issue, "10-cover.json"), JSON.stringify({ question: { zh: "示例" } }));
  writeFileSync(join(issue, "11-diagram.svg"), "<svg></svg>");
  mkdirSync(join(issue, "20-assets"), { recursive: true });
  writeFileSync(join(issue, "20-assets", "cover.jpg"), "fake-image");
  writeFileSync(join(issue, "30-issue.json"), JSON.stringify({ cover: { photo: "20-assets/cover.jpg" }, comic: { diagram: "11-diagram.svg" } }));
  writeFileSync(join(issue, "31-review.md"), "结论：通过，见 20-assets/cover.jpg");
  writeFileSync(join(issue, "50-narration.json"), JSON.stringify({ narration: [] }));
  // 单文件旧期和 legacy/，迁移脚本不应该碰
  writeFileSync(join(root, "issues", "006.json"), JSON.stringify({ issue: 6, legacy: true }));
  writeFileSync(join(root, "issues", "legacy", "001.json"), JSON.stringify({ issue: 1 }));
  writeFileSync(join(root, "feedback.jsonl"), [
    JSON.stringify({ issue: 7, favorite: "环球小报", dislike: "挑战" }),
    JSON.stringify({ issue: 6, favorite: "不认识的页名", quote: "原话不能动" }),
  ].join("\n") + "\n");
  writeFileSync(join(root, "creature-log.md"), "# 传说怪物档案\n\n历史内容。");
  writeFileSync(join(root, "think-log.md"), "# 周末思辨\n\n历史内容。");
  writeFileSync(join(root, "thinking-plan.md"), "# 思维课表\n\n历史内容。");
  writeFileSync(join(root, "profile.md"), "# 读者画像 · 小明\n\n- 称呼：小明 / Ming\n- 刊名：小明早知道 · MING KNOWS!（团子编辑部出品）\n- 信箱页 send_note：拍照发给妈妈\n");
  writeFileSync(join(root, "voices", "azure.json"), "{}");
}

test("renames a directory-format issue's files and embedded asset paths, leaving single-file and legacy issues untouched", t => {
  const root = tmp(t);
  syntheticRepo(root);
  run(root);
  const issue = join(root, "issues", "007");
  for (const f of ["brief.json", "cover.json", "diagram.svg", "issue.json", "review.md", "narration.json"]) assert.ok(existsSync(join(issue, f)), f);
  for (const f of ["00-brief.json", "10-cover.json", "11-diagram.svg", "30-issue.json", "31-review.md", "50-narration.json"]) assert.ok(!existsSync(join(issue, f)), f);
  assert.ok(existsSync(join(issue, "assets", "cover.jpg")));
  assert.ok(!existsSync(join(issue, "20-assets")));

  const merged = JSON.parse(readFileSync(join(issue, "issue.json"), "utf8"));
  assert.equal(merged.cover.photo, "assets/cover.jpg");
  assert.equal(merged.comic.diagram, "diagram.svg");
  assert.match(readFileSync(join(issue, "review.md"), "utf8"), /assets\/cover\.jpg/);

  assert.ok(existsSync(join(root, "issues", "006.json")), "单文件旧期保持原样");
  assert.deepEqual(JSON.parse(readFileSync(join(root, "issues", "006.json"), "utf8")), { issue: 6, legacy: true });
  assert.ok(existsSync(join(root, "issues", "legacy", "001.json")), "legacy/ 保持原样");
});

test("running the script twice makes no further changes", t => {
  const root = tmp(t);
  syntheticRepo(root);
  run(root);
  const snapshot = f => existsSync(f) ? readFileSync(f, "utf8") : null;
  const issue = join(root, "issues", "007"), before = snapshot(join(issue, "issue.json"));
  const output = run(root);
  assert.match(output, /没有要迁移的内容/);
  assert.equal(snapshot(join(issue, "issue.json")), before);
});

test("feedback.jsonl maps favorite/dislike page names to skill ids and leaves quotes untouched", t => {
  const root = tmp(t);
  syntheticRepo(root);
  run(root);
  const rows = readFileSync(join(root, "feedback.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
  assert.equal(rows[0].favorite, "news");
  assert.equal(rows[0].dislike, "challenge");
  assert.equal(rows[1].favorite, "不认识的页名", "认不出的页名原样留着，不瞎猜");
  assert.equal(rows[1].quote, "原话不能动");
});

test("the four markdown archives move into state/<skill>/config.md with an empty log.jsonl alongside", t => {
  const root = tmp(t);
  syntheticRepo(root);
  run(root);
  assert.ok(existsSync(join(root, "state", "creature", "config.md")));
  assert.match(readFileSync(join(root, "state", "creature", "config.md"), "utf8"), /历史内容/);
  assert.equal(readFileSync(join(root, "state", "creature", "log.jsonl"), "utf8"), "");
  assert.ok(existsSync(join(root, "state", "think", "config.md")));
  assert.ok(!existsSync(join(root, "creature-log.md")));
  assert.ok(!existsSync(join(root, "think-log.md")));
});

test("profile.md's masthead/call/send_note become magazine.yaml; thinking-plan.md moves to curriculum/", t => {
  const root = tmp(t);
  syntheticRepo(root);
  run(root);
  const yaml = readFileSync(join(root, "magazine.yaml"), "utf8");
  assert.match(yaml, /zh: 小明早知道/);
  assert.match(yaml, /en: MING KNOWS!/);
  assert.match(yaml, /by: 团子编辑部出品/);
  assert.match(yaml, /call: 小明/);
  assert.match(yaml, /send_note: 拍照发给妈妈/);
  assert.doesNotMatch(yaml, /^voices:/m, "复杂的供应商/克隆配置留在 voices/*.json 里，不塞进简单的 voices 字段");
  assert.ok(existsSync(join(root, "curriculum", "thinking-plan.md")));
  assert.ok(!existsSync(join(root, "thinking-plan.md")));
});
