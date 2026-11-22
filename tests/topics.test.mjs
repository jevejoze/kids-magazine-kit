import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inputFingerprint, recordBuild } from "../scripts/build-state.mjs";
import { pageOrder } from "../scripts/contracts.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { fallbackPlan } from "../scripts/plan.mjs";
import { appendTopics, compareTopics, readTopics, TOPICS_FILE, topicContext } from "../scripts/topics.mjs";

const demo = new URL("../examples/demo/", import.meta.url);
const scripts = new URL("../scripts/", import.meta.url);
const json = f => JSON.parse(readFileSync(f, "utf8"));
const put = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2));
const row = (overrides = {}) => ({
  issue: 1, date: "2026-10-01", section: "news", id: "n-voyager-old", title: "旧报里的太空探测器",
  entities: ["旅行者 1 号"], mechanism: null, event: null, url: "https://example.org/old", source: "archive",
  ...overrides,
});
function fixture(t) {
  const data = mkdtempSync(join(tmpdir(), "kids-topics-"));
  t.after(() => rmSync(data, { recursive: true, force: true }));
  cpSync(demo, data, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { data, issue: join(data, "issues/003") };
}
const run = (cwd, script, ...args) => spawnSync(process.execPath, [fileURLToPath(new URL(script, scripts)), ...args], { cwd, encoding: "utf8" });

test("新闻 URL 与事件永久去重，实体按窗口与别名去重", t => {
  const { data } = fixture(t);
  put(join(data, "state/topic-aliases.json"), { "旅行者1号": ["旅行者一号", "VOYAGER 1"] });
  const ctx = topicContext(data);
  const old = row({ event: "探测器再次恢复和地球的通信", urls: ["https://example.org/other"] });
  const candidate = row({
    id: "n-voyager-new", date: "2026-10-22", title: "今日航天新闻", event: "NASA确认：探测器再次恢复和地球的通信",
    entities: ["Voyager-1"], url: "https://EXAMPLE.org/other#new",
  });
  const messages = compareTopics(candidate, old, ctx);
  assert.match(messages.map(m => m.text).join("\n"), /URL 重复[\s\S]*同事件重复[\s\S]*实体重复/);
  assert.ok(messages.every(m => !m.warning));
  assert.deepEqual(compareTopics({ ...candidate, date: "2027-10-22" }, old, ctx).map(m => m.text), messages.slice(0, 2).map(m => m.text));
  const followup = { ...candidate, followup_of: old.url };
  assert.deepEqual(compareTopics(followup, old, ctx), messages.slice(0, 2), "跟进仅豁免新闻实体窗口");
  const allowed = compareTopics({ ...candidate, allow_repeat: "对比上一期的进展" }, old, ctx);
  assert.equal(allowed.length, 3);
  assert.ok(allowed.every(m => m.warning && m.text.includes("对比上一期的进展")));
  writeFileSync(join(data, "magazine.yaml"), "\ndedupe:\n  news_entity_days: 22\n  news_url: false\n", { flag: "a" });
  const override = topicContext(data);
  const other = { ...candidate, date: "2026-10-23", event: null };
  assert.equal(compareTopics(other, old, ctx).length, 1, "默认 21 天已过，但永久 URL 仍拦");
  assert.match(compareTopics(other, old, override)[0].text, /实体重复/);
});

test("封面和说法的永久文字、栏目实体、机制与历史标题窗口分别生效", t => {
  const { data } = fixture(t), ctx = topicContext(data);
  const cover = row({ section: "cover", title: "超级乐器为什么能够发出声音", entities: ["木吉他"], mechanism: "弦 振动" });
  const current = { ...cover, date: "2026-10-31", title: "超级乐器<br>为什么能够发出声音？", mechanism: "弦·振动" };
  assert.match(compareTopics(current, cover, ctx).map(m => m.text).join("\n"), /问题重复[\s\S]*机制重复[\s\S]*同栏目实体重复/);
  assert.equal(compareTopics({ ...current, date: "2026-11-15" }, cover, ctx).length, 2);
  assert.equal(compareTopics({ ...current, date: "2026-11-16" }, cover, ctx).length, 1);
  const check = { ...current, section: "check", date: "2026-10-15" };
  assert.equal(compareTopics(check, cover, ctx)[0].warning, true);
  assert.deepEqual(compareTopics({ ...check, date: "2026-10-16" }, cover, ctx), []);
  assert.match(compareTopics({ ...check, date: "2027-10-01" }, { ...cover, section: "check" }, ctx)[0].text, /说法重复/);
  const fuzzy = compareTopics({ ...current, title: "超级乐器为什？" }, { ...cover, mechanism: null, entities: [] }, ctx);
  assert.equal(fuzzy.length, 1);
  assert.equal(fuzzy[0].warning, true);
  assert.match(fuzzy[0].text, /历史标题相似/);
});

test("backfill 默认只打印，--write 同期同栏不重复，recent 显示已用来源", t => {
  const { data } = fixture(t), legacy = join(data, "issues/legacy");
  mkdirSync(legacy);
  put(join(legacy, "001.json"), { issue: 1, date: "2026.10.12 周一", question: { zh: "历史<br>封面？" }, news: { items: [
    { title: "旧的新闻", sources: ["https://example.org/legacy"] },
  ] } });
  const dry = run(data, "topics.mjs", "backfill");
  assert.equal(dry.status, 0, dry.stderr);
  const records = dry.stdout.trim().split("\n").map(JSON.parse);
  assert.equal(records.length, 7);
  assert.equal(records[0].title, "历史封面？");
  assert.ok(records.every(r => r.source === "backfill" && !r.entities.length));
  assert.deepEqual(readTopics(data), []);
  assert.equal(run(data, "topics.mjs", "backfill", "--write").status, 0);
  assert.equal(run(data, "topics.mjs", "backfill", "--write").stdout, "");
  assert.deepEqual(readTopics(data), records);
  const recent = run(data, "topics.mjs", "recent", "2026-11-22");
  assert.equal(recent.status, 0, recent.stderr);
  assert.equal(JSON.parse(recent.stdout).news.length, 4);
  assert.match(recent.stdout, /example.org\/legacy/);
});

test("出稿检查会拦截自选新闻的第二个来源，排除本期总账", t => {
  const { data, issue } = fixture(t), briefFile = join(issue, "brief.json");
  const brief = json(briefFile);
  brief.plan = { week: "2026-W42", date: "2026-10-14", status: "missing", fallback: [] };
  put(briefFile, brief);
  const news = json(join(issue, "news.json"));
  const source = news.items[0].sources[1];
  appendTopics(data, [row({ issue: 3, url: source })]);
  assert.ok(!createPipeline(issue).check().some(e => e.includes("URL 重复")));
  appendTopics(data, [row({ issue: 2, url: source })]);
  const result = run(data, "pipeline.mjs", "check", "issues/003");
  assert.equal(result.status, 2);
  assert.match(result.stdout, /新闻 URL 重复/);
  assert.match(result.stdout, /第 2 期/);
});

test("archive 追加实际栏目及备用卡元数据，重跑不重复，并在回执登记", t => {
  const { data, issue } = fixture(t);
  fallbackPlan(issue, "check", null, "原说法的来源失效");
  const checkFile = join(issue, "check.json"), check = json(checkFile);
  check.claim = json(join(issue, "brief.json")).plan.check.claim;
  put(checkFile, check);
  const p = createPipeline(issue);
  p.assemble();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${p.fingerprint()}\n`);
  const names = pageOrder(json(join(issue, "issue.json"))).map((_, i) => `card-${i + 1}.png`);
  names.push("小满早知道-第003期.pdf");
  mkdirSync(join(issue, "cards"));
  const files = names.map(name => join(issue, "cards", name));
  for (const file of files) writeFileSync(file, "测试用生成品");
  recordBuild(issue, "render", inputFingerprint(issue, "render"), files);
  writeFileSync(join(issue, ".lock"), "{}");
  const receipt = p.archive(), records = readTopics(data);
  assert.equal(existsSync(join(issue, ".lock")), false);
  assert.ok(receipt.updated.includes(TOPICS_FILE));
  assert.deepEqual(records.map(r => r.section), ["cover", "check", "news", "news", "news"]);
  assert.ok(records.every(r => r.source === "archive" && r.date === "2026-10-14"));
  assert.equal(records[0].id, "c-midnight-sun");
  assert.equal(records[0].mechanism, "地轴倾斜");
  assert.doesNotMatch(records[0].title, /<br>/);
  assert.equal(records[1].id, "k-spider-insect");
  assert.deepEqual(records[1].entities, ["蜘蛛"]);
  assert.equal(records[2].event, "伦敦女孩获国际象棋女子特级大师称号并刷新年龄纪录");
  assert.equal(records[2].urls.length, 1);
  assert.deepEqual(p.archive(), receipt);
  assert.deepEqual(readTopics(data), records);
  put(join(issue, "archive.json"), receipt);
  assert.equal(p.done("archive"), true);
  assert.equal(run(data, "pipeline.mjs", "plan-check", "plan/2026-W42.json").status, 0);
});
