import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fallbackPlan } from "../scripts/plan.mjs";

const demo = new URL("../examples/demo/", import.meta.url);
const command = fileURLToPath(new URL("../scripts/notify.mjs", import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "kids-notify-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(demo, dir, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return dir;
}
function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [command, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.trimEnd().split("\n").length <= 25);
  return result.stdout;
}

test("周排通知按日期输出星期、封面、真的假的和备用卡", t => {
  const root = fixture(t), text = run(root, "plan", "2026-W42");
  assert.match(text, /^📅.*2026-W42/);
  assert.match(text, /2026-10-14 星期三｜挪威夏天半夜.*｜极昼时，太阳一直停在同一个位置/);
  assert.match(text, /备用卡\n封面｜肥皂泡.*｜在山谷里.*\n真的假的｜所有蜘蛛/);
  assert.doesNotMatch(text, /<br>|why_reader|https:\/\//);
});

test("定稿通知显示新闻建议标题、每次变更和原因", t => {
  const root = fixture(t), file = join(root, "plan/2026-W42.json");
  const plan = JSON.parse(readFileSync(file, "utf8"));
  plan.days["2026-10-14"].revised.push({ what: "换封面", why: "孩子刚问过极昼", at: plan.at, by: "内部署名" });
  writeFileSync(file, JSON.stringify(plan));
  const text = run(root, "finalize", "2026-10-14");
  assert.match(text, /^📝 明日选题已定稿（2026-10-14）/);
  assert.match(text, /封面｜挪威[\s\S]+新闻｜鹈鹕敲门求救/);
  assert.match(text, /变更｜换封面（孩子刚问过极昼）/);
  assert.doesNotMatch(text, /内部署名|https:\/\//);
});

test("出刊通知含成品、未完成步骤、每次降级及审稿摘录，限制 25 行", t => {
  const root = fixture(t), issue = join(root, "issues/003"), review = join(issue, "review.md");
  fallbackPlan(issue, "cover", null, "没有合适的照片");
  fallbackPlan(issue, "news", "n-2026-10-14-chess", "来源页面打不开");
  writeFileSync(review, "## 值得家长看\n- 可以试试用手电筒做极昼实验。\n\n## 内部讨论\n不要出现在通知");
  const text = run(root, "issue", "issues/003");
  assert.match(text, /^📰 第 003 期出刊（2026-10-14）\n网盘｜成品\/003\//);
  assert.match(text, /未完成｜.*讲读视频/);
  assert.match(text, /降级｜封面 c-midnight-sun → c-bubbles（没有合适的照片）/);
  assert.match(text, /降级｜环球小报 n-2026-10-14-chess → 自选（来源页面打不开）/);
  assert.match(text, /值得家长看\n可以试试用手电筒做极昼实验。/);
  assert.doesNotMatch(text, /内部讨论|不要出现在通知/);
  writeFileSync(review, "## 值得家长看\n" + "一行建议\n".repeat(30));
  assert.equal(run(root, "issue", "issues/003").trimEnd().split("\n").length, 25);
  rmSync(review);
  assert.doesNotMatch(run(root, "issue", "issues/003"), /值得家长看/);
});
