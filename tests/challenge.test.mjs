import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.ok(card.includes(data.challenge.puzzle.question));
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
  assert.ok(card.includes(data.challenge.puzzle.body));
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
