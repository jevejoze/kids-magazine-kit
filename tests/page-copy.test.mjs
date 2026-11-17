import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { render as renderNews } from "../sections/news/page.js";
import { render as renderCheck } from "../sections/check/page.js";
import { render as renderMailbox } from "../sections/mailbox/page.js";
import { render as renderSerialBook } from "../sections/serial-book/page.js";

const demo = new URL("../examples/demo/", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-copy-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };

const kit = {
  topBar: (tag, right) => `[top ${tag} | ${right ?? ""}]`,
  foot: left => `[foot ${left}]`,
  ch: spec => `[ch ${spec}]`,
  serialPage: (SR, opts) => JSON.stringify(opts),
};
const newsItem = (title, credit) => ({ flag: "🇯🇵", place: "日本", title, text: "正文", photo: "p.jpg", credit });

test("poster news prints each photo's credit in its own footer and the question on the last page only", () => {
  const pages = renderNews({
    layout: "poster", week: "11.10–11.16", ask_zh: "你怎么看？", ask_en: "What do you think?", credits: "来源：甲 照片：乙",
    items: [newsItem("头一条", "David Wipf · CC BY 2.0"), newsItem("第二条", "© MBARI")],
  }, kit);
  assert.equal(pages.length, 2);
  assert.match(pages[0], /\| 头条\]/);
  assert.match(pages[1], /\| 第 2 条\]/);
  assert.match(pages[0], /\[foot 照片：David Wipf · CC BY 2\.0\]/);
  assert.match(pages[1], /\[foot 照片：© MBARI\]/);
  assert.doesNotMatch(pages[0], /你怎么看/);
  assert.match(pages[1], /💬 你怎么看？/);
  assert.doesNotMatch(pages.join(""), /往后翻|交叉核实|来源：甲/);
});

test("poster news from an old issue.json without per-item credits still credits the photos on the last page", () => {
  const pages = renderNews({ layout: "poster", credits: "照片：乙", items: [newsItem("头一条"), newsItem("第二条")] }, kit);
  assert.match(pages[0], /\[foot \]/);
  assert.doesNotMatch(pages[0], /照片：乙/);
  assert.match(pages[1], /照片：乙/);
});

test("buildIssue carries each news item's photo_credit into the merged issue", t => {
  const { issue } = copyDemo(t);
  const source = json(join(issue, "news.json"));
  const merged = createPipeline(issue).buildIssue();
  assert.deepEqual(merged.news.items.map(x => x.credit), source.items.map(x => x.photo_credit));
});

test("poster news takes exactly 2 items", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[news]")).join("\n");
  edit(join(issue, "news.json"), n => { n.layout = "poster"; });
  assert.match(errors(), /大图版新闻要 2 条/);
  edit(join(issue, "news.json"), n => { n.items.pop(); });
  assert.equal(errors(), "");
});

test("the check page asks to circle again instead of writing, and keeps the tools off the page", () => {
  const html = renderCheck({
    where: "家族群", claim: "说法", clues: ["一", "二", "三"], verdict: "观点！",
    choices: ["📏 事实", "💭 观点", "🧩 都有"], tools: [["🔍 哪个词露馅了？", "“最美”"]],
  }, kit);
  assert.match(html, /Really\?/);
  assert.equal(html.split("<span>💭 观点</span>").length - 1, 2, "选项印两次：快脑袋一次，慢脑袋一次");
  assert.match(html, /慢脑袋改主意了吗？/);
  assert.doesNotMatch(html, /哪个词露馅了|我的结论|class="lines"|往后翻/);
  assert.match(html, /\[foot \]/);
});

test("the mailbox page ends the blunder on the makeup line and drops the public-shaming copy", () => {
  const html = renderMailbox({
    hello: "妮妮好！", send_note: "拍照发给爸爸",
    blunder: { who: "owl", title: "博士扛望远镜等流星", desc: "经过", makeup: "团子狗：下次一起躺着看。" },
    treehole: { target: "owl", question: "问一个怪问题！", hint: "比如：流星许愿要排队吗？" },
  }, kit);
  assert.match(html, /🙈 今日翻车/);
  assert.match(html, /翻车的是：咕咕博士/);
  assert.match(html, /团子狗：下次一起躺着看。/);
  assert.match(html, /🕳️ 树洞 · 难倒咕咕博士/);
  assert.match(html, />比如：流星许愿要排队吗？</, "示范只加一次「比如：」");
  assert.doesNotMatch(html, /处刑|丢人|绝不原谅|案件|责任人|反套路|Target:|本周/);
  assert.doesNotMatch(renderMailbox({}, kit), /小满/, "兜底文案不带示例孩子的名字");
});

test("mailbox check requires a makeup line of at most 20 characters", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[mailbox]")).join("\n");
  assert.equal(errors(), "");
  edit(join(issue, "mailbox.json"), m => { m.blunder.makeup = "字".repeat(21); });
  assert.match(errors(), /和好的那一句 21 字，超过 20/);
  edit(join(issue, "mailbox.json"), m => { delete m.blunder.makeup; });
  assert.match(errors(), /缺少和好的那一句/);
});

const serial = { ep: 10, book_zh: "柳林风声", book_en: "The Wind in the Willows", title_zh: "鼻子闻到了家", title_en: "Mole Smells Home", chapter: "第 5 章", author: "Kenneth Grahame · 1908", quote: { en: "My old home!", zh: "我的老家！", who: "鼹鼠" } };

test("the serial page puts the recap under the title and moves chapter and author to the credit line", () => {
  const withRecap = JSON.parse(renderSerialBook({ ...serial, recap: "上回：獾带大家钻出野林。" }, kit));
  assert.equal(withRecap.meta, "上回：獾带大家钻出野林。");
  assert.deepEqual(withRecap.credit, ["第 5 章", "Kenneth Grahame · 1908"]);
  const old = JSON.parse(renderSerialBook(serial, kit));
  assert.equal(old.meta, "第 5 章　·　Kenneth Grahame · 1908", "旧期没有 recap，照旧印章节和作者");
  assert.deepEqual(old.credit, []);
});

test("serial-book check requires a recap from the second episode on", t => {
  const { issue } = copyDemo(t);
  const errors = () => createPipeline(issue).check().filter(e => e.startsWith("[serial]")).join("\n");
  assert.equal(errors(), "", "第 1 回不用写");
  edit(join(issue, "serial.json"), r => { r.ep = 2; });
  edit(join(issue, "brief.json"), b => { if (b.serial) b.serial.ep = 2; });
  assert.match(errors(), /第 2 回起要写一句上回前情 recap/);
  edit(join(issue, "serial.json"), r => { r.recap = "字".repeat(31); });
  assert.match(errors(), /上回前情 31 字，超过 30/);
});
