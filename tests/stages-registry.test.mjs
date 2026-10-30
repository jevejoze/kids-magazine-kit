import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSections } from "../scripts/sections.mjs";

const engine = new URL("..", import.meta.url).pathname;
const { stages } = JSON.parse(readFileSync(join(engine, "pipeline", "stages.json"), "utf8"));
// 流水线自己的步骤（合并、审稿、渲染、讲读、语音、视频、归档、下载图片、任务书），不对应任何栏目包
const RESERVED = ["brief", "assets", "assemble", "review", "render", "narration", "audio", "video", "archive"];

test("every non-reserved stage.json entry corresponds to a registered section pack, with the right id, section and output path", () => {
  const { sections, errors } = loadSections({ engine });
  assert.deepEqual(errors, []);
  const byId = new Map(sections.map(s => [s.id, s]));
  // slot 包（经典连载的四种形态）共用一个页位 key 当 stage id
  const packOfSlot = key => sections.find(s => s.manifest.slot?.key === key);
  for (const stage of stages) {
    if (RESERVED.includes(stage.id)) continue;
    const pack = byId.get(stage.id) ?? packOfSlot(stage.id);
    assert.ok(pack, `stage ${stage.id} 在注册表里找不到对应的栏目包`);
    assert.equal(stage.section, stage.id, `stage ${stage.id} 的 section 该等于自己的 id`);
    assert.ok(stage.outputs.includes(`issue/${stage.id}.json`), `stage ${stage.id} 的输出该是 issue/${stage.id}.json`);
  }
});

test("every registered content pack (or its slot) has a stage.json entry", () => {
  const { sections } = loadSections({ engine });
  const stageIds = new Set(stages.map(s => s.id));
  const keys = new Set(sections.map(s => s.manifest.slot?.key ?? s.id));
  for (const key of keys) assert.ok(stageIds.has(key), `栏目 ${key} 没有对应的 stage.json 条目`);
});

test("comic's stage depends on cover, matching its declared consumes: cover.question", () => {
  const comic = stages.find(s => s.id === "comic");
  assert.ok(comic.depends.includes("cover"));
});
