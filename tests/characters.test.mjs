import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { loadCharacterPack } from "../scripts/character-pack.mjs";
import { issueHtml } from "../scripts/sections.mjs";

const source = readFileSync(new URL("../assets/characters.js", import.meta.url), "utf8");
const names = ["dog", "mouse", "owl", "raccoon"];
const moods = ["normal", "happy", "wave", "smirk", "sleepy", "angry", "surprise", "talk", "think"];

function runtime(pack) {
  const definitions = [];
  const context = vm.createContext({ CHARACTER_PACK: pack,
    document: { body: { insertAdjacentHTML: (_, html) => definitions.push(html) } },
    Image: class { decode() { return Promise.resolve(); } },
  });
  vm.runInContext(source, context);
  return { draw: (name, mood, props = "") => vm.runInContext(`draw(${JSON.stringify(name)},${JSON.stringify(mood)},160,${JSON.stringify(props)})`, context), definitions };
}

test("versioned PNG pack covers all 36 expressions and has alpha channels", () => {
  const pack = loadCharacterPack("storybook-v1");
  assert.equal(Object.keys(pack.characters).length, 4);
  for (const name of names) {
    assert.deepEqual(Object.keys(pack.characters[name].frames), moods);
    const png = Buffer.from(pack.images[name].split(",")[1], "base64");
    assert.equal(png[25], 6, `${name} must be RGBA PNG`);
  }
});

test("same character spec always renders the same fixed frame and embeds each atlas once", () => {
  const run = runtime(loadCharacterPack("storybook-v1"));
  assert.equal(run.definitions.length, 1);
  assert.equal((run.definitions[0].match(/<image /g) || []).length, 4);
  for (const name of names) for (const mood of moods) {
    const first = run.draw(name, mood);
    assert.equal(first, run.draw(name, mood));
    assert.match(first, new RegExp(`href="#kids-character-${name}"`));
    assert.match(first, new RegExp(`data-expression="${mood}"`));
    assert.doesNotMatch(first, /data:image/);
  }
  assert.notEqual(run.draw("dog", "normal"), run.draw("dog", "surprise"));
});

test("props and paper boxes use the same PNG identity", () => {
  const run = runtime(loadCharacterPack("storybook-v1"));
  assert.match(run.draw("dog", "surprise", "eyemask"), /prop-eyemask/);
  assert.match(run.draw("owl", "think", "magnifier"), /circle/);
  assert.match(run.draw("dogbox", "sleepy"), /data-character="dog"/);
  assert.match(run.draw("box", "peek"), /data-character="raccoon"/);
  assert.throws(() => run.draw("dog", "missing"), /缺少/);
});

test("omitting the pack keeps existing SVG rendering", () => {
  const run = runtime(null);
  assert.equal(run.definitions.length, 0);
  assert.match(run.draw("dog", "happy"), /<svg/);
  assert.doesNotMatch(run.draw("dog", "happy"), /data-character-pack/);
});

test("invalid pack names cannot traverse directories", () => {
  assert.throws(() => loadCharacterPack("../../private"), /名称必须带版本/);
  assert.throws(() => loadCharacterPack(""), /名称必须带版本/);
});

test("changed pixels are rejected instead of silently changing an existing version", async t => {
  const root = mkdtempSync(join(tmpdir(), "kids-character-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  cpSync(new URL("../scripts/character-pack.mjs", import.meta.url), join(root, "scripts/character-pack.mjs"));
  cpSync(new URL("../assets/characters/storybook-v1", import.meta.url), join(root, "assets/characters/storybook-v1"), { recursive: true });
  const path = join(root, "assets/characters/storybook-v1/dog.png"), bytes = readFileSync(path);
  bytes[bytes.length - 16] ^= 1;
  writeFileSync(path, bytes);
  const { loadCharacterPack: load } = await import(pathToFileURL(join(root, "scripts/character-pack.mjs")));
  assert.throws(() => load("storybook-v1"), /图片已被修改/);
});

test("comic speaker names inherit their configured expression and accessories", () => {
  const issue = JSON.parse(readFileSync(new URL("../examples/demo/issues/003/issue.json", import.meta.url), "utf8"));
  issue.comic.panels[0].chars = ["dog:surprise:120:eyemask"];
  issue.comic.panels[0].bubbles[0].who = "dog";
  const root = { outerHTML: "" }, cardIds = html => JSON.parse(html.match(/const CARD_IDS = (.*);/)[1]);
  let ids = [];
  const context = vm.createContext({
    document: { body: { insertAdjacentHTML() {} }, getElementById: () => root, querySelector: () => null, querySelectorAll: () => ids.map(id => ({ id, closest: () => null })) },
    Image: class { decode() { return Promise.resolve(); } }, location: { hash: "" }, window: {},
  });
  const template = issueHtml({ data: issue, characterPack: loadCharacterPack("storybook-v1"), characters: source });
  ids = cardIds(template);
  vm.runInContext(template.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  const comic = root.outerHTML.match(/<section class="card" data-section="comic">[\s\S]*?<\/section>/)[0];
  assert.match(comic, /data-character="dog" data-expression="surprise"/);
  assert.match(comic, /prop-eyemask/);
});


test("eye masks center on both eyes in SVG and in every PNG pose", () => {
  const svg = runtime(null).draw("dog", "surprise", "eyemask");
  assert.match(svg, /translate\(100 110\) rotate\(0\)/);
  // Both ends are mirrored around the eye midpoint, rather than an asymmetric relative path.
  assert.match(svg, /M-52 -16 Q-32 -24 0 -12 Q32 -24 52 -16/);
  const pack = loadCharacterPack("storybook-v1"), run = runtime(pack);
  for (const name of names) for (const mood of moods) {
    const [lx, ly, rx, ry] = pack.characters[name].attachments[mood].eyes;
    const output = run.draw(name, mood, "eyemask");
    const [, x, y, angle] = output.match(/<g transform="translate\(([-.\d]+) ([-.\d]+)\) rotate\(([-.\d]+)\)">/);
    assert.equal(Number(x), (lx + rx) / 2);
    assert.equal(Number(y), (ly + ry) / 2);
    assert.equal(Number(angle), Math.atan2(ry - ly, rx - lx) * 180 / Math.PI);
  }
});

test("scarves follow the pose neck instead of the old full-body coordinates", () => {
  const pack = loadCharacterPack("storybook-v1"), run = runtime(pack);
  for (const mood of moods) {
    const [x, y, width] = pack.characters.mouse.attachments[mood].neck;
    assert.ok(run.draw("mouse", mood, "scarf").includes(`translate(${x} ${y}) scale(${width/116})`));
  }
});
