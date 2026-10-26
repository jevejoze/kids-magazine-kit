import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { loadCharacterPack } from "../scripts/character-pack.mjs";
import vm from "node:vm";
import { validateIssue, validateStructure, pageOrder, CARD_IDS } from "../scripts/contracts.mjs";

const issue = () => JSON.parse(readFileSync(new URL("../examples/demo/issues/003/30-issue.json", import.meta.url), "utf8"));
function render(data) {
  const root = { outerHTML: "" }, ids = pageOrder(data).map(key => CARD_IDS[key]);
  const context = vm.createContext({ document: {
    body: { insertAdjacentHTML() {} }, getElementById: () => root, querySelector: () => null,
    querySelectorAll: () => ids.map(id => ({ id })),
  }, Image: class {}, location: { hash: "" }, window: {} });
  const template = readFileSync(new URL("../assets/template.html", import.meta.url), "utf8")
    .replace("{{CHARACTER_PACK}}", "null")
    .replace("{{CHARACTERS}}", () => readFileSync(new URL("../assets/characters.js", import.meta.url), "utf8"))
    .replace("{{CARD_IDS}}", () => JSON.stringify(ids))
    .replace("{{DATA}}", () => JSON.stringify(data));
  vm.runInContext(template.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return id => root.outerHTML.match(new RegExp(`<section class="[^"]*" id="${id}">[\\s\\S]*?<\\/section>`))[0];
}

test("tablet challenge separates conditions and question, and reveals this issue's answers on the page", () => {
  const data = issue(), card = render(data)("c5");
  assert.match(card, /class="clues"><li>/);
  assert.ok(card.replace(/<[^>]+>/g, "").includes(data.challenge.puzzle.question));
  assert.ok(card.includes(data._answers.puzzle));
  assert.ok(card.includes(data._answers.english[0]));
  assert.doesNotMatch(card, /class="(?:draft|slots|lines|stamp|mine)"|答案明天|手账|我的答案/);
  assert.match(card, /class="answer-content"/);
});

test("legacy body-only puzzles render without writing areas or English answers when disabled", () => {
  const data = issue();
  delete data.challenge.puzzle.clues; delete data.challenge.puzzle.question;
  delete data.challenge.english;
  data.challenge.puzzle.slots = ["___"];
  assert.deepEqual(validateIssue(data), []);
  const card = render(data)("c5");
  assert.ok(card.replace(/<[^>]+>/g, "").includes(data.challenge.puzzle.body));
  assert.doesNotMatch(card, /class="clues"|class="english-key"|___/);
});

test("mailbox ignores stale prior-issue answers", () => {
  const data = issue(); data.mailbox.answers = "上期谜题答案不应出现在信箱";
  const card = render(data)("c6");
  assert.doesNotMatch(card, /上期|class="box answers/);
  assert.ok(card.includes(data.mailbox.hello));
});

test("missing answers and malformed structured conditions are blocked before rendering", () => {
  const data = issue(); delete data._answers.puzzle;
  assert.ok(validateIssue(data).some(e => e.includes("_answers.puzzle")));
  data.challenge.puzzle.clues = "不是数组";
  assert.ok(validateIssue(data).some(e => e.includes("clues")));
  const puzzle = JSON.parse(readFileSync(new URL("../examples/demo/issues/003/14-puzzle.json", import.meta.url), "utf8"));
  puzzle.clues = [null];
  assert.ok(validateStructure("14-puzzle.json", puzzle).some(e => e.includes("clues")));
  puzzle.clues = ["条件一"]; delete puzzle.question;
  assert.ok(validateStructure("14-puzzle.json", puzzle).some(e => e.includes("question")));
});

test("standard challenge samples omit optional English and each has one solution", () => {
  const samples = Object.fromEntries(["queue", "math", "order"].map(id => [id, JSON.parse(readFileSync(new URL(`../examples/challenge-previews/${id}.json`, import.meta.url), "utf8"))]));
  for (const sample of Object.values(samples)) {
    const data = issue(); data.challenge = { taunt_zh: sample.taunt_zh, taunt_en: "Three clues. Can you solve it?", prop: sample.prop, puzzle: sample.puzzle }; data._answers.puzzle = sample.answer;
    assert.deepEqual(validateIssue(data), []);
    const card = render(data)("c5");
    assert.doesNotMatch(card, /class="route"|english-key|with-english|Three clues/);
    assert.ok(card.indexOf('class="clues"') < card.indexOf('class="question"'));
  }
  const perms = values => values.length ? values.flatMap((v, i) => perms(values.filter((_, j) => j !== i)).map(rest => [v, ...rest])) : [[]];
  // 唯一解，而且每条线索都用得上：去掉任何一条都不止一个解
  const solve = (items, clues, answer) => {
    const solutions = rules => perms(items).filter(p => rules.every(rule => rule(p)));
    assert.deepEqual(solutions(clues).map(p => p.join(" → ")), [answer]);
    clues.forEach((_, i) => assert.ok(solutions(clues.filter((__, j) => j !== i)).length > 1, `${answer}: 线索 ${i + 1} 多余`));
  };
  const at = (p, x) => p.indexOf(x);
  solve(["艾莎", "健太", "卢卡", "阿米尔"], [
    p => ![0, 3].includes(at(p, "艾莎")), p => p[0] !== "健太",
    p => Math.abs(at(p, "阿米尔") - at(p, "艾莎")) === 1, p => at(p, "健太") < at(p, "卢卡"),
  ], samples.queue.answer);
  solve(["红", "黄", "蓝", "绿", "紫"], [
    p => ![0, 4].includes(at(p, "红")), p => ![0, 4].includes(at(p, "黄")),
    p => at(p, "绿") === at(p, "红") + 3, p => at(p, "黄") < at(p, "蓝"),
  ], samples.order.answer);
  const boats = Array.from({ length: 37 }, (_, a) => [a, 36 - a]).filter(([a, b]) => a >= 4 && b + 4 === 2 * (a - 4));
  assert.deepEqual(boats, [[16, 20]]); assert.equal(`甲船${boats[0][0]}人，乙船${boats[0][1]}人。`, samples.math.answer);
});

const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
test("short and full-budget Chinese challenges fit both character modes with small inverted answers", { skip: !chrome }, t => {
  const dir = mkdtempSync(join(tmpdir(), "kids-challenge-budget-"));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
  const data = issue(); data.cover = {};
  data.challenge = { taunt_zh: "字".repeat(20), prop: "magnifier", puzzle: {
    title: "题".repeat(14) + "<br>" + "目".repeat(14), body: "情境".repeat(60),
    clues: Array.from({ length: 4 }, () => "条件".repeat(12)), question: "提问".repeat(12),
  } };
  const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
  const short = JSON.parse(read("../examples/challenge-previews/queue.json"));
  const full = data.challenge;
  for (const [name, challenge] of [["short", { taunt_zh: short.taunt_zh, prop: short.prop, puzzle: short.puzzle }], ["full", full]]) {
    data.challenge = challenge;
    for (const mode of ["svg", "png"]) {
      let html = read("../assets/template.html").replace("{{STYLE}}", () => read("../assets/style.css"))
        .replace("{{CHARACTER_PACK}}", () => JSON.stringify(mode === "png" ? loadCharacterPack("storybook-v1") : null))
        .replace("{{CHARACTERS}}", () => read("../assets/characters.js"))
        .replace("{{CARD_IDS}}", () => JSON.stringify(pageOrder(data).map(k => CARD_IDS[k]))).replace("{{DATA}}", () => JSON.stringify(data));
      html = html.replace("</body>", `<script>window.READY.then(()=>{
        const c=document.querySelector('#c5'),r=c.getBoundingClientRect(),p=c.querySelector('.puz').getBoundingClientRect(),a=c.querySelector('.answer-key').getBoundingClientRect(),f=c.querySelector('.foot').getBoundingClientRect();
        const result={compact:c.classList.contains('challenge-compact'),footer:f.bottom<=r.bottom-56+1,answer:p.bottom+15<=a.top&&a.bottom<=f.top,
          answerSmall:parseFloat(getComputedStyle(c.querySelector('.puzzle-key')).fontSize)<=20&&parseFloat(getComputedStyle(c.querySelector('.puzzle-key')).fontSize)<parseFloat(getComputedStyle(c.querySelector('.clues li')).fontSize)&&Number(getComputedStyle(c.querySelector('.puzzle-key')).fontWeight)<=400,
          text:[...c.querySelectorAll('.taunt-text,.puz h3,.body,.clues li>span,.question,.answer-content')].every(e=>e.scrollWidth<=e.clientWidth+1),
          flipped:getComputedStyle(c.querySelector('.answer-content')).transform.startsWith('matrix(-1, 0, 0, -1'),
          noEnglish:!c.querySelector('.route,.english-key,.taunt .en')};
        const e=document.createElement('pre');e.id='layout-result';e.textContent=JSON.stringify(result);document.body.append(e);
      });</script></body>`);
      const file = join(dir, name + "-" + mode + ".html"); writeFileSync(file, html);
      const dom = execFileSync(chrome, ["--headless=new", "--disable-gpu", `--user-data-dir=${join(dir, name + "-" + mode + "-profile")}`, "--window-size=1080,1440", "--virtual-time-budget=5000", "--dump-dom", pathToFileURL(file).href + "#c5"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 30 * 1024 * 1024, timeout: 25000 });
      const result = dom.match(/<pre id="layout-result">(\{[^<]+\})<\/pre>/);
      assert.ok(result, `${name}/${mode}: browser did not finish layout measurement`);
      const metrics = JSON.parse(result[1]);
      t.diagnostic(`${name}/${mode}: ${JSON.stringify(metrics)}`);
      for (const key of ["footer", "answer", "answerSmall", "text", "flipped", "noEnglish"]) assert.equal(metrics[key], true, `${name}/${mode}: ${key}`);
    }
  }
});
