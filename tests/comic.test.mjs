import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { pageOrder, CARD_IDS, validateStructure } from "../scripts/contracts.mjs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const issue = () => JSON.parse(read("../examples/demo/issues/003/30-issue.json"));
function render(data) {
  const root = { outerHTML: "" }, ids = pageOrder(data).map(key => CARD_IDS[key]);
  const context = vm.createContext({ document: { body: { insertAdjacentHTML() {} }, getElementById: () => root, querySelector: () => null, querySelectorAll: () => ids.map(id => ({ id })) }, Image: class {}, location: { hash: "" }, window: {} });
  const html = read("../assets/template.html").replace("{{CHARACTER_PACK}}", "null").replace("{{CHARACTERS}}", () => read("../assets/characters.js")).replace("{{CARD_IDS}}", () => JSON.stringify(ids)).replace("{{DATA}}", () => JSON.stringify(data));
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return root.outerHTML.match(/<section class="card" id="c2">[\s\S]*?<\/section>/)[0];
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
