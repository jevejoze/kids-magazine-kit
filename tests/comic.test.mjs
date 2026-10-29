import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { loadCharacterPack } from "../scripts/character-pack.mjs";
import { issueHtml } from "../scripts/sections.mjs";
import vm from "node:vm";
import { validateStructure, validateIssue, validateComicContent } from "../scripts/contracts.mjs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const issue = () => JSON.parse(read("../examples/demo/issues/003/30-issue.json"));
function render(data) {
  const root = { outerHTML: "" }, cardIds = html => JSON.parse(html.match(/const CARD_IDS = (.*);/)[1]);
  let ids = [];
  const context = vm.createContext({ document: { body: { insertAdjacentHTML() {} }, getElementById: () => root, querySelector: () => null, querySelectorAll: () => ids.map(id => ({ id, closest: () => null })) }, Image: class {}, location: { hash: "" }, window: {} });
  const html = issueHtml({ data });
  ids = cardIds(html);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return root.outerHTML.match(/<section class="card" data-section="comic">[\s\S]*?<\/section>/)[0];
}

test("comic reads two panels, then the diagram, then the follow-up panels", () => {
  const data = issue(), html = render(data);
  const second = html.indexOf(data.comic.panels[1].title), diagram = html.indexOf('class="box diagram"'), third = html.indexOf(data.comic.panels[2].title);
  assert.ok(second >= 0 && second < diagram && diagram < third);
  assert.equal((html.match(/class="box panel p/g) || []).length, 4);
  assert.ok(html.includes(data.comic.takeaway));
  assert.match(html, /width="130" height="130"/);
  assert.match(html, />十二点<\/span>/);
});

test("older comics still render without the new captions or takeaway", () => {
  const data = issue();
  for (const field of ["diagram_title", "takeaway", "fact_title"]) delete data.comic[field];
  for (const panel of data.comic.panels) delete panel.title;
  const html = render(data);
  assert.equal((html.match(/class="box panel p/g) || []).length, 4);
  assert.doesNotMatch(html, /class="takeaway"|undefined/);
  assert.match(html, /咕咕博士画给你看/);
});

test("malformed new comic fields are rejected before template rendering", () => {
  const data = issue().comic;
  data.takeaway = { text: "不能把对象直接当成文字" };
  data.panels[0].title = null;
  const errors = validateStructure("11-comic.json", data);
  assert.ok(errors.some(e => e.includes("takeaway")));
  assert.ok(errors.some(e => e.includes("panels[0].title")));
});

test("comic budgets count literal text and reject HTML and oversized character specs", () => {
  const data = issue().comic;
  data.panels[0].bubbles[0].text = "字".repeat(27);
  data.panels[2].bubbles[0].text = "字".repeat(21);
  data.panels[2].bubbles[1].who = "owl:talk:160";
  data.takeaway = "字".repeat(29); data.fact = "字".repeat(46);
  const errors = validateComicContent(data);
  for (const limit of [26, 20, 28, 45]) assert.ok(errors.some(e => e.includes(`最多 ${limit} 字`)));
  assert.ok(errors.some(e => e.includes("130px")));
  data.panels[0].bubbles[0].text = "<b>短句</b>";
  assert.ok(validateComicContent(data).some(e => e.includes("纯文本")));
  data.panels[0].bubbles[0].text = "1 < 2 > 0";
  assert.ok(!validateComicContent(data).some(e => e.includes("第 1 格")));
  const html = render({ ...issue(), comic: data });
  assert.match(html, /&lt;/); assert.match(html, /&gt;/);
});

const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
test("full comic budgets with two-line headings and 130px roles fit in SVG and PNG modes", { skip: !chrome }, t => {
  const dir = mkdtempSync(join(tmpdir(), "kids-comic-budget-"));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
  const data = issue(); data.cover = {};
  const c = data.comic;
  c.title_zh = "问".repeat(18) + "<br>" + "题".repeat(18);
  c.title_en = "Can you follow the clue all the way around?<br>Look closely, then tell us what changes.";
  c.diagram_title = "图".repeat(28); c.takeaway = "结".repeat(28); c.fact = "知".repeat(45); c.fact_title = "延".repeat(8);
  c.diagram = read("../examples/demo/issues/003/11-diagram.svg");
  c.panels.forEach((p, i) => {
    p.title = "题".repeat(12);
    p.chars = (i < 2 ? ["dog:normal:130"] : ["dog:normal:130", "owl:normal:130"]);
    p.bubbles = p.chars.map(who => ({ who: who.split(":")[0], lang: "zh", text: "字".repeat(i < 2 ? 26 : 20) }));
  });
  assert.deepEqual(validateIssue(data), []);
  for (const mode of ["svg", "png"]) {
    let html = issueHtml({ data, characterPack: mode === "png" ? loadCharacterPack("storybook-v1") : null });
    const check = `<script>window.READY.then(()=>{
      const c=document.querySelector('#comic .card'),r=c.getBoundingClientRect(),f=c.querySelector('.foot').getBoundingClientRect();
      const result={footer:f.bottom<=r.bottom-parseFloat(getComputedStyle(c).paddingBottom)+1,
        above:c.querySelector('.fact').getBoundingClientRect().bottom<=f.top+1,
        figure:c.querySelector('.diagram svg').getBoundingClientRect().height,
        applied:parseFloat(c.style.getPropertyValue('--comic-diagram-height')),
        text:[...c.querySelectorAll('.bubble-text,.takeaway,.fact')].every(e=>e.scrollWidth<=e.clientWidth+1),
        panels:[...c.querySelectorAll('.panel')].every(p=>{const b=p.getBoundingClientRect();return [...p.querySelectorAll('.bub,.ch')].every(e=>{const q=e.getBoundingClientRect();return q.left>=b.left&&q.right<=b.right&&q.bottom<=b.bottom;});})};
      document.body.insertAdjacentHTML('beforeend','<pre id="budget-result">'+JSON.stringify(result)+'</pre>');
    });</script>`;
    html = html.replace("</body>", check + "</body>");
    const file = join(dir, mode + ".html"); writeFileSync(file, html);
    const dom = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${join(dir, mode)}`, "--window-size=1080,1440", "--virtual-time-budget=5000", "--dump-dom", pathToFileURL(file).href + "#comic"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 30 * 1024 * 1024, timeout: 45000 });
    const m = JSON.parse(dom.match(/<pre id="budget-result">(\{[^<]+\})<\/pre>/)[1]);
    t.diagnostic(`${mode}: diagram ${m.figure}px, footer ${m.footer}, text ${m.text}`);
    for (const key of ["footer", "above", "text", "panels"]) assert.equal(m[key], true, `${mode}: ${key}`);
    assert.ok(m.figure >= 200 && m.figure <= 280);
    assert.ok(m.applied >= 200 && m.applied <= 280);
  }
});
