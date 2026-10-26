import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const template = readFileSync(new URL("../assets/template.html", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(template.match(/const coverSegmenter[\s\S]*?(?=const CV =)/)[0], context);
const format = text => vm.runInContext(`coverQuestion(${JSON.stringify(text)})`, context);

test("cover questions keep numbers and their units on the same line", () => {
  for (const phrase of ["十二点", "12 点", "2 吨", "23.5度"]) {
    assert.ok(format(`半夜${phrase}，太阳还在天上？`).includes(`>${phrase}，</span>`));
  }
});

test("Chinese word boundaries preserve mummy and editorial line breaks", () => {
  const output = format("古埃及人做木乃伊，<br>那猫咪呢？");
  assert.ok(output.includes('>木乃伊，</span>'));
  assert.equal((output.match(/<br>/g) || []).length, 1);
  assert.equal(output.replace(/<span[^>]*>|<\/span>/g, ""), "古埃及人做木乃伊，<br>那猫咪呢？");
});
