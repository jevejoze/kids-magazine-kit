import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import { ticket } from "../scripts/ticket.mjs";
import { createPipeline } from "../scripts/pipeline-lib.mjs";
import { loadSections, validateManifest } from "../scripts/sections.mjs";
import { validateMagazine } from "../scripts/schedule.mjs";
import { parseYaml } from "../scripts/yaml.mjs";
import { inputFingerprint, recordBuild } from "../scripts/build-state.mjs";
import { fetchAssets as fetchCreature } from "../sections/creature/fetch.mjs";
import { fetchAssets as fetchNews } from "../sections/news/fetch.mjs";

const engine = new URL("..", import.meta.url).pathname;
const demo = new URL("../examples/demo/", import.meta.url).pathname;
const tmp = t => { const d = mkdtempSync(join(tmpdir(), "kids-creature-")); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const copyDemo = t => {
  const root = tmp(t);
  cpSync(demo, root, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  return { root, issue: join(root, "issues", "003") };
};
const json = f => JSON.parse(readFileSync(f, "utf8"));
const edit = (f, fn) => { const v = json(f); fn(v); writeFileSync(f, JSON.stringify(v, null, 2)); };
const registry = () => loadSections({ engine }).sections;

const creature = {
  _meta: { stage: "creature", by: "测试" },
  no: 1, name_zh: "大海蛇", parts: [{ en: "Sea", zh: "海" }, { en: "Serpent", zh: "大蛇" }],
  legend_url: "https://example.org/legend.jpg", legend_credit: "老版画 · 公有领域", legend_pos: "center",
  photo_url: "https://example.org/oarfish.jpg", photo_credit: "示例 · CC BY 3.0", photo_pos: "center",
  tag: "🌊 深海", stats: [{ k: "传说身长", v: "60 米" }, { k: "真实原型", v: "皇带鱼" }, { k: "原型身长", v: "8 米" }],
  meters: [{ label: "吓人", n: 4, icon: "😱" }, { label: "真实", n: 3, icon: "🔍" }],
  boxes: [{ title: "📜 传说里说", text: "水手说海里有一条长蛇。" }, { title: "🔬 科学家怎么说", text: "冲上岸的标本是一条长鱼。" }, { title: "🐟 真实原型", text: "皇带鱼又长又扁。" }],
  fast: "一定是真的大海蛇！", slow: "有没有抓到过标本？", sources: ["https://example.org/a", "https://example.org/b"],
  log_update: "No.001 大海蛇 → 皇带鱼",
};
// 周一：任务书写上 creature，补怪物卡和两张图
const monday = issue => {
  edit(join(issue, "brief.json"), b => { b.creature = true; });
  writeFileSync(join(issue, "creature.json"), JSON.stringify(creature));
  mkdirSync(join(issue, "assets", "creature"), { recursive: true });
  for (const f of ["creature.jpg", "creature-legend.jpg"]) cpSync(join(issue, "assets", "cover.jpg"), join(issue, "assets", "creature", f));
  edit(join(issue, "assets", "assets.json"), a => { a.creature = "creature/creature.jpg"; a.creature_legend = "creature/creature-legend.jpg"; });
};

test("creature and news register as packs with valid manifests", () => {
  const reg = registry();
  for (const id of ["creature", "news"]) {
    const pack = reg.find(s => s.id === id);
    assert.ok(pack, id);
    assert.deepEqual(validateManifest(pack.manifest), [], id);
  }
  assert.equal(reg.find(s => s.id === "creature").manifest.image_policy, "free-only");
  assert.equal(reg.find(s => s.id === "news").manifest.image_policy, "private-ok");
});

test("[creature] and [news] checks come from the packs", t => {
  const { issue } = copyDemo(t);
  const errors = tag => createPipeline(issue).check().filter(e => e.startsWith(tag));
  assert.deepEqual(errors("[news]"), []);
  edit(join(issue, "news.json"), n => { n.items[1].text = "字".repeat(51); delete n.items[2].photo_shows; n.items.pop(); });
  const news = errors("[news]").join("\n");
  assert.match(news, /新闻要 3 条/);
  assert.match(news, /第 2 条 51 字，超过 50/);

  monday(issue);
  assert.deepEqual(errors("[creature]"), []);
  writeFileSync(join(issue, "creature.json"), JSON.stringify({ ...creature, name_zh: "非常非常长的海怪名字", sources: ["一个"], meters: [{ label: "吓人", n: 7 }] }));
  const cr = errors("[creature]").join("\n");
  assert.match(cr, /名字 10 字，超过 8/);
  assert.match(cr, /要 2 个来源/);
  assert.match(cr, /meters 要 2–3 条/);
});

test("a free-only magazine can still select the news pack (editorial choice: use only freely-licensed photos)", () => {
  const base = parseYaml(readFileSync(join(demo, "magazine.yaml"), "utf8"));
  const free = { ...base, image_policy: "free-only" };
  delete free.params;
  assert.deepEqual(validateMagazine(free, registry()), []);
});

test("the creature card only appears on Mondays", t => {
  const { issue } = copyDemo(t);
  writeFileSync(join(issue, "creature.json"), JSON.stringify(creature));
  assert.throws(() => ticket(issue, "creature"), /本期不出/);
  createPipeline(issue).assemble();
  assert.equal(json(join(issue, "issue.json")).creature, undefined);

  monday(issue);
  const tk = ticket(issue, "creature");
  assert.equal(tk.content.skill, "creature");
  assert.equal(tk.content.stage, "creature");
  assert.equal(tk.content.params.narration_lines, 14);
  assert.deepEqual(tk.content.state, ["data/creature-log.md"], "还没建 state/creature/ 就沿用 creature-log.md");
  assert.equal(ticket(issue, "creature").fingerprint, tk.fingerprint);
  createPipeline(issue).assemble();
  assert.equal(json(join(issue, "issue.json")).creature.name_zh, "大海蛇");
  assert.equal(ticket(issue, "news").content.params.narration_lines, 24);
});

test("fetch scripts download into assets/<pack id>/", async t => {
  const { issue } = copyDemo(t);
  writeFileSync(join(issue, "creature.json"), JSON.stringify(creature));
  const got = [];
  const get = async (url, out) => { got.push([url, out]); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, "jpg"); };
  assert.deepEqual(await fetchCreature(issue, { get }), { creature: "creature/creature.jpg", creature_legend: "creature/creature-legend.jpg" });
  assert.deepEqual(got.map(g => g[0]), [creature.legend_url, creature.photo_url]);
  assert.ok(existsSync(join(issue, "assets", "creature", "creature-legend.jpg")));

  got.length = 0;
  const urls = ["https://example.org/1.jpg", "https://example.org/2.jpg", "https://example.org/3.jpg"];
  assert.deepEqual(await fetchNews(issue, { urls, get }), { news: ["news/news-1.jpg", "news/news-2.jpg", "news/news-3.jpg"] });
  assert.deepEqual(got.map(g => g[1]), [1, 2, 3].map(i => join(issue, "assets", "news", `news-${i}.jpg`)));
  await assert.rejects(fetchNews(issue, { urls: ["https://example.org/1.jpg", "不是链接"], get }), /第 2 条：不是链接/);
});

function rendered(issue) {
  const p = createPipeline(issue);
  p.assemble();
  const fingerprint = p.fingerprint();
  writeFileSync(join(issue, "review.md"), `结论：通过\n内容指纹：${fingerprint}\n`);
  edit(join(issue, "narration.json"), n => { n._meta.content_hash = fingerprint; });
  mkdirSync(join(issue, "cards"), { recursive: true });
  const names = [...Array.from({ length: 10 }, (_, i) => `cards/card-${i + 1}.png`), "cards/小满早知道-第003期.pdf"];
  for (const name of names) writeFileSync(join(issue, name), "generated");
  recordBuild(issue, "render", inputFingerprint(issue, "render"), names.map(f => join(issue, f)));
  return p;
}

test("archive appends the creature to state/creature/log.jsonl when it exists, else to creature-log.md", t => {
  const legacy = copyDemo(t);
  monday(legacy.issue);
  assert.ok(rendered(legacy.issue).archive().updated.includes("creature-log.md"));
  assert.match(readFileSync(join(legacy.root, "creature-log.md"), "utf8"), /No\.1（第 003 期）：No\.001 大海蛇 → 皇带鱼/);

  const { root, issue } = copyDemo(t);
  monday(issue);
  mkdirSync(join(root, "state", "creature"), { recursive: true });
  const before = readFileSync(join(root, "creature-log.md"), "utf8");
  const p = rendered(issue);
  assert.ok(p.archive().updated.includes("state/creature/log.jsonl"));
  const log = readFileSync(join(root, "state", "creature", "log.jsonl"), "utf8");
  assert.deepEqual(log.trim().split("\n").map(l => JSON.parse(l)), [{ issue: 3, date: json(join(issue, "brief.json")).date, no: 1, name_zh: "大海蛇", summary: "No.001 大海蛇 → 皇带鱼" }]);
  assert.equal(readFileSync(join(root, "creature-log.md"), "utf8"), before, "新目录不再写 creature-log.md");
  p.archive();
  assert.equal(readFileSync(join(root, "state", "creature", "log.jsonl"), "utf8"), log, "重复归档不重复追加");
});
