import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { isoWeek } from "../scripts/plan.mjs";
import { scheduleIssue } from "../scripts/schedule.mjs";
import { ticket } from "../scripts/ticket.mjs";
import { appendTopics } from "../scripts/topics.mjs";

const demo = new URL("../examples/demo/", import.meta.url);
const cli = fileURLToPath(new URL("../scripts/pipeline.mjs", import.meta.url));
const path = "plan/2026-W42.json", date = "2026-10-14";
const json = f => JSON.parse(readFileSync(f, "utf8"));
const put = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2));
const edit = (f, fn) => { const value = json(f); fn(value); put(f, value); };
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], {
  cwd, encoding: "utf8", env: { ...process.env, KIDS_MAG_AGENT: "测试执行" },
});
const planCheck = cwd => run(cwd, "plan-check", path);
const history = (v = {}) => ({
  issue: 1, date: "2026-10-10", section: "news", id: "n-other", title: "以前的新闻",
  entities: [], mechanism: null, event: null, url: null, source: "archive", ...v,
});
function fixture(t) {
  const data = mkdtempSync(join(tmpdir(), "kids-plan-"));
  t.after(() => rmSync(data, { recursive: true, force: true }));
  cpSync(demo, data, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  const issue = join(data, "issues/003");
  return { data, issue, planFile: join(data, path), brief: join(issue, "brief.json") };
}

test("plan-check 校验结构、ISO 周、新闻条数和日期、跨计划卡 id", t => {
  const { data, planFile, brief } = fixture(t);
  const valid = planCheck(data);
  assert.equal(valid.status, 0, valid.stderr + valid.stdout);
  assert.equal(isoWeek("2027-01-01"), "2026-W53");
  const plan = json(planFile), original = structuredClone(plan);
  rmSync(brief);
  plan.days["2026-10-18"] = structuredClone(plan.days[date]);
  const invalid = plan.days["2026-10-18"];
  invalid.cover.question = "字".repeat(25);
  invalid.cover.number = 23.5;
  invalid.check.claim = "字".repeat(31);
  invalid.news = [{ ...invalid.news[0], published: "2026-10-19" }];
  plan.days["2026-10-19"] = invalid;
  put(planFile, plan);
  const broken = planCheck(data);
  assert.equal(broken.status, 2);
  for (const message of [/24 字/, /30 字/, /number/, /日前 7 天/, /news 要有 3 条/, /不在 2026-W42 内/]) assert.match(broken.stdout, message);

  put(planFile, original);
  const other = { ...original, week: "2026-W43", days: {} };
  put(join(data, "plan/2026-W43.json"), other);
  const duplicate = planCheck(data);
  assert.equal(duplicate.status, 2);
  assert.match(duplicate.stdout, /id 重复：c-bubbles/);
});

test("ready 新闻条数等于 params.news.count（默认 3），没排新闻时为零条", t => {
  const { data, planFile, brief } = fixture(t);
  rmSync(brief);
  edit(planFile, p => { p.days[date].news = p.days[date].news.slice(0, 2); });
  assert.match(planCheck(data).stdout, /news 要有 3 条（magazine.yaml params.news.count），当前 2 条/);
  writeFileSync(join(data, "magazine.yaml"), readFileSync(join(data, "magazine.yaml"), "utf8")
    .replace("    narration_lines: 26", "    narration_lines: 26\n    layout: poster\n    count: 1"));
  edit(planFile, p => { p.days[date].news = p.days[date].news.slice(0, 1); });
  const poster = planCheck(data);
  assert.equal(poster.status, 0, poster.stdout + poster.stderr);
  const magazine = join(data, "magazine.yaml");
  writeFileSync(magazine, readFileSync(magazine, "utf8")
    .replace("    creature: [mon]", "    creature: [mon]\n    news: [thu]\n    check: [thu]"));
  assert.match(planCheck(data).stdout, /news 要有 0 条/);
  edit(planFile, p => { p.days[date].news = []; delete p.days[date].check; });
  assert.equal(planCheck(data).status, 0);
});

test("plan-check 对比总账、尚未出刊的其它周和同周卡，重复理由降级", t => {
  const { data, planFile, brief } = fixture(t), plan = json(planFile), day = plan.days[date];
  rmSync(brief);
  const [card] = day.news;
  appendTopics(data, [history({ url: card.url, event: card.event, entities: card.entities })]);
  const rejected = planCheck(data);
  assert.equal(rejected.status, 2);
  assert.match(rejected.stdout, /新闻 URL 重复[\s\S]+同事件重复[\s\S]+实体重复/);
  card.allow_repeat = "用两篇报道对比同一事件";
  const extra = {
    ...day, status: "draft", cover: { ...plan.spares.cover[0], id: "c-bubbles-again" },
    check: { ...plan.spares.check[0], id: "k-spider-again" }, news: [],
  };
  put(planFile, { ...plan, days: { ...plan.days, "2026-10-16": extra } });
  const same = planCheck(data);
  assert.equal(same.status, 2);
  assert.match(same.stdout, /封面问题重复/);
  put(planFile, plan);
  const future = { ...plan, week: "2026-W43", spares: {}, days: { "2026-10-19": extra } };
  put(join(data, "plan/2026-W43.json"), future);
  const pending = planCheck(data);
  assert.equal(pending.status, 2);
  assert.match(pending.stdout, /2026-10-12 .*封面问题重复/);
  rmSync(join(data, "plan/2026-W43.json"));
  const allowed = planCheck(data);
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
  assert.match(allowed.stdout, /警告：.*允许重复：用两篇报道对比同一事件/);
});

test("schedule 原样快照并固定 topic_hint，修改或删除已开工选题会被拒绝", t => {
  const { data, issue, planFile, brief } = fixture(t), plan = json(planFile), day = plan.days[date];
  edit(brief, b => { delete b.plan; });
  assert.deepEqual(scheduleIssue(issue).plan, { ...day, week: plan.week, date, fallback: [] });
  assert.equal(json(brief).topic_hint, day.cover.question);
  edit(planFile, p => { p.days[date].notes = "这条变更发生在开工后"; });
  assert.deepEqual(scheduleIssue(issue).plan, { ...day, week: plan.week, date, fallback: [] });
  assert.match(planCheck(data).stdout, /已开工，不能再改/);
  edit(planFile, p => { delete p.days[date]; });
  assert.match(planCheck(data).stdout, /已开工，不能再改/);
  const missing = scheduleIssue(join(data, "issues/004"), "2026-10-15");
  assert.deepEqual(missing.plan, { week: "2026-W42", date: "2026-10-15", status: "missing", fallback: [] });
});

test("fallback 跳过重复和用过的备用卡，保留原周排的锁定，任务单按换卡更新指纹", t => {
  const { data, issue, planFile, brief } = fixture(t);
  const plan = json(planFile), [first, second] = plan.spares.cover;
  const old = history({ section: "cover", title: first.question, entities: first.entities });
  appendTopics(data, [old]);
  const before = ticket(issue, "cover");
  assert.match(before.markdown, /选题卡（照写，不换题）[\s\S]+c-midnight-sun[\s\S]+近期用过/);
  assert.match(ticket(issue, "comic").markdown, /c-midnight-sun/);
  assert.match(ticket(issue, "check").markdown, /k-sun-stands-still/);
  assert.match(ticket(issue, "news").markdown, /n-2026-10-14-chess/);
  appendTopics(data, [history({ issue: 2, section: "cover", title: "以前用过的封面" })]);
  assert.notEqual(ticket(issue, "cover").fingerprint, before.fingerprint, "近期用过的清单进指纹");
  const fallback = run(data, "plan-fallback", "issues/003", "cover", "没找到可用的照片");
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.match(fallback.stdout, /c-midnight-sun → c-echo/);
  assert.deepEqual(json(brief).plan.cover, second);
  assert.equal(json(brief).topic_hint, second.question);
  assert.equal(json(brief).plan.fallback[0].by, "测试执行");
  assert.deepEqual(json(planFile), plan);
  assert.match(ticket(issue, "cover").markdown, /c-echo/);
  assert.notEqual(ticket(issue, "cover").fingerprint, before.fingerprint);
  // 清除故意插入的旧条目后，降级未破坏原日卡的锁定比较。
  writeFileSync(join(data, "state/topics.jsonl"), "");
  assert.equal(planCheck(data).status, 0);
  edit(planFile, p => { p.days[date].cover.mechanism = "事后改过的机制"; });
  assert.match(planCheck(data).stdout, /已开工，不能再改/);

  mkdirSync(join(data, "issues/004"));
  put(join(data, "issues/004/brief.json"), { issue: 4, date: "2026-10-15", plan: { cover: first } });
  const free = run(data, "plan-fallback", "issues/003", "cover", "声波的数字无法核实");
  assert.equal(free.status, 0, free.stderr);
  assert.match(free.stdout, /c-echo → free/);
  assert.doesNotMatch(ticket(issue, "cover").markdown, /选题卡（照写，不换题）/);
});

test("check 核对封面、说法和新闻独立来源，新闻作废后允许一条替代", t => {
  const { data, issue } = fixture(t), cover = join(issue, "cover.json"), claim = join(issue, "check.json"), news = join(issue, "news.json");
  const baseline = json(news), coverBefore = json(cover), claimBefore = json(claim);
  const errors = () => createPipeline(issue).check({ contentOnly: true }).join("\n");
  edit(cover, c => { c.question.zh = c.question.zh.replace("<br>", "  "); });
  edit(claim, c => { c.claim = " <br> " + c.claim; });
  assert.doesNotMatch(errors(), /与选题卡.*不一致/);
  edit(cover, c => { c.question.zh = "为什么要换掉封面问题？"; });
  edit(claim, c => { c.claim = "这里用了另一个说法。"; });
  const [a, b] = baseline.items;
  edit(news, n => {
    // 第一条包含两张卡的 URL，但第二条没有，不能一稿匹配两卡。
    n.items[0].sources.push(b.sources[0]);
    n.items[1].sources = ["https://example.org/new", "https://example.org/new2"];
  });
  assert.match(errors(), /\[cover\].*不一致[\s\S]+\[check\].*不一致[\s\S]+\[news\].*独立稿件/);
  const fallback = run(data, "plan-fallback", "issues/003", "news", "n-2026-10-14-pelican", "来源打不开");
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.match(fallback.stdout, /n-2026-10-14-pelican → free/);
  assert.equal(run(data, "plan-fallback", "issues/003", "news", "n-2026-10-14-pelican", "重复降级").status, 2);
  assert.equal(run(data, "plan-fallback", "issues/003", "news", "缺少新闻 ID").status, 2);
  edit(news, n => { n.items[0].sources = a.sources; });
  put(cover, coverBefore);
  put(claim, claimBefore);
  assert.doesNotMatch(errors(), /选题卡|降级/);
  assert.doesNotMatch(ticket(issue, "news").markdown, /n-2026-10-14-pelican/);
});

test("plan-amend 把主编改过的卡重新快照进已开工的任务书，保留仍有效的降级", t => {
  const { data, issue, planFile, brief } = fixture(t);
  assert.equal(run(data, "plan-amend", "issues/003").status, 2, "必须写原因");
  const news = run(data, "plan-fallback", "issues/003", "news", "n-2026-10-14-pelican", "来源打不开");
  assert.equal(news.status, 0, news.stderr);
  const chess = json(planFile).days[date].news.find(c => c.id === "n-2026-10-14-chess");
  edit(planFile, p => {
    const day = p.days[date];
    day.news = day.news.map(c => c.id === chess.id ? { ...c, id: "n-2026-10-14-chess-2" } : c);
    day.revised.push({ at: "2026-10-13T20:00:00+08:00", by: "测试主编", what: "换新闻卡", why: "测试" });
  });
  assert.match(planCheck(data).stdout, /已开工，不能再改/);
  const amended = run(data, "plan-amend", "issues/003", "主编换了一张新闻卡");
  assert.equal(amended.status, 0, amended.stderr);
  assert.match(amended.stdout, /改了 news/);
  const planCheckAfter = planCheck(data);
  assert.equal(planCheckAfter.status, 0, planCheckAfter.stdout);
  const b = json(brief);
  assert.ok(b.plan.news.some(c => c.id === "n-2026-10-14-chess-2"));
  assert.deepEqual(b.plan.fallback.map(r => r.from), ["n-2026-10-14-pelican"], "原卡还在，降级保留");
  assert.equal(b._meta.plan_amended.at(-1).reason, "主编换了一张新闻卡");
  assert.match(ticket(issue, "news").markdown, /n-2026-10-14-chess-2/);
  edit(planFile, p => { p.days[date].news[0].published = "2030-01-01"; });
  assert.equal(run(data, "plan-amend", "issues/003", "坏卡").status, 2, "plan-check 不过就不快照");
});

test("skipped 的日子要写原因，不参与去重也不快照选题卡", t => {
  const { data, issue, planFile, brief } = fixture(t);
  rmSync(brief);
  edit(planFile, p => { p.days[date] = { status: "skipped", revised: [] }; });
  assert.match(planCheck(data).stdout, /skipped 时要在 notes/);
  edit(planFile, p => { p.days[date].notes = "全家出门旅行，这天不出"; });
  const ok = planCheck(data);
  assert.equal(ok.status, 0, ok.stdout);
  assert.equal(scheduleIssue(issue, date).plan.status, "missing");
});
