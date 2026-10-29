import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseYaml, YamlError } from "../scripts/yaml.mjs";

const fixture = name => readFileSync(new URL(`./fixtures/yaml/${name}`, import.meta.url), "utf8");

test("解析 map、list、行内列表和各种标量", () => {
  assert.deepEqual(parseYaml(fixture("full.yaml")), {
    masthead: { zh: "小满早知道", en: "XIAOMAN KNOWS!", by: "团子编辑部 # 不是注释" },
    image_policy: "private-ok",
    sections: ["cover", "comic", "creature"],
    flow: ["make", "music", "make", "film"],
    empty_flow: [],
    schedule: { days: { creature: ["mon"] }, friday: { serial: ["make", "music"] } },
    params: { story: { narration_lines: 28 }, check: { enabled: true, ratio: 0.5 } },
    nothing: null,
    tilde: null,
    voices: [{ who: "narrator", zh: "zh-CN-XiaoxiaoNeural" }, { who: "dog", zh: "zh-CN-YunxiaNeural" }],
  });
});

test("空文件是空 map", () => {
  assert.deepEqual(parseYaml("# 只有注释\n\n"), {});
});

test("顶层可以是 list，list 里可以套 list", () => {
  assert.deepEqual(parseYaml("- a\n-\n  - b\n  - 3\n"), ["a", ["b", 3]]);
});

for (const [name, src, line, pattern] of [
  ["锚点", "a: &x 1\n", 1, /锚点/],
  ["多行块", "a: |\n  text\n", 1, /多行块/],
  ["行内 map", "a: {b: 1}\n", 1, /行内 map/],
  ["多文档", "a: 1\n---\nb: 2\n", 2, /多文档/],
  ["制表符", "a:\n\tb: 1\n", 2, /制表符/],
  ["重复的名字", "a: 1\na: 2\n", 2, /重复/],
  ["多缩进", "a: 1\n  b: 2\n", 2, /缩进/],
  ["不像 key: value", "a: 1\njust text\n", 2, /名字: 值/],
  ["引号不配对", 'a: "oops\n', 1, /引号/],
  ["行内列表嵌套", "a: [b, [c]]\n", 1, /嵌套/],
]) {
  test(`不支持的写法报错并带行号：${name}`, () => {
    assert.throws(() => parseYaml(src), err => err instanceof YamlError && err.line === line && pattern.test(err.message) && err.message.startsWith(`第 ${line} 行`));
  });
}
