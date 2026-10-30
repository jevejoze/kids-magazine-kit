#!/usr/bin/env node
// 一次性迁移脚本：把数据仓库从旧的数字前缀命名转成 skill id 命名。
//   node scripts/migrate-v2.mjs <数据目录>
// 只在数据仓库的副本上跑，不要对着真实数据仓库直接跑；跑完用 scripts/regress.mjs 比对像素。
// 可重复运行：已经是新格式的文件和目录不会被再处理一遍。
//   - 期内文件改名：13-story.json → story.json 等；006.json 这类单文件旧期和 legacy/ 保持原样
//   - feedback.jsonl 的 favorite / dislike 从中文页名换成 skill id，原话（quote 等）不动
//   - 四份 markdown 档案（creature-log.md、story-bible.md、serial-bible.md、think-log.md）整份搬进对应栏目的
//     state/<id>/config.md；历史内容原样保留在 config.md 里，新建一个空的 log.jsonl 供以后追加（旧文件里已有的
//     单行进度记录格式不统一，这里不强行拆分字段，归档脚本从迁移后的下一期开始正常写 log.jsonl）
//   - profile.md 开头的称呼、刊名、send_note，以及 voices/*.json，合并进新建的 magazine.yaml；
//     thinking-plan.md 移到 curriculum/thinking-plan.md
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const FILE_RENAME = {
  "00-brief.json": "brief.json", "08-think.json": "think.json", "09-creature.json": "creature.json",
  "10-cover.json": "cover.json", "11-comic.json": "comic.json", "11-diagram.svg": "diagram.svg",
  "12-words.json": "words.json", "13-story.json": "story.json", "14-puzzle.json": "challenge.json",
  "15-english.json": "english.json", "16-mailbox.json": "mailbox.json", "17-news.json": "news.json",
  "18-serial.json": "serial.json", "19-check.json": "check.json", "30-issue.json": "issue.json",
  "30-build.json": "build.json", "31-review.md": "review.md", "50-narration.json": "narration.json",
  "90-archive.json": "archive.json",
};
const DIR_RENAME = { "20-assets": "assets", "40-cards": "cards", "60-audio": "audio", "70-final": "final" };
// 信箱「最喜欢哪一页」这类中文页名 → skill id（给 feedback.jsonl 用）
const PAGE_NAME_TO_ID = {
  封面: "cover", 今日一问: "comic", 传说怪物档案: "creature", 单词屋: "words", 小剧场: "story",
  挑战: "challenge", 环球小报: "news", 真的假的: "check", 经典连载: "serial", 音乐盒: "serial",
  放映室: "serial", 动手做: "serial", 周末思辨: "think", 信箱: "mailbox",
};
const log = [];
const note = s => { log.push(s); console.log(s); };

// 已经合并过的 issue.json、narration.json 里，图片路径是按旧目录名字面写死的（如 "20-assets/cover.jpg"），
// 改名只搬了目录，这些文件内容里的旧路径也要一起换，不然图找不到
function fixEmbeddedPaths(dir) {
  let changed = false;
  for (const name of ["issue.json", "narration.json", "review.md"]) {
    const f = join(dir, name);
    if (!existsSync(f)) continue;
    const before = readFileSync(f, "utf8");
    let after = before;
    for (const [oldDir, newDir] of Object.entries(DIR_RENAME)) after = after.split(`${oldDir}/`).join(`${newDir}/`);
    // 今日一问的图解 SVG 是直接写文件名引用的（不在 assets/ 目录下），单独换
    after = after.split('"11-diagram.svg"').join('"diagram.svg"');
    if (after !== before) { writeFileSync(f, after); changed = true; }
  }
  return changed;
}

function migrateIssueDir(dir) {
  let changed = false;
  for (const [oldName, newName] of Object.entries(FILE_RENAME)) {
    const from = join(dir, oldName), to = join(dir, newName);
    if (existsSync(from) && !existsSync(to)) { renameSync(from, to); changed = true; }
  }
  for (const [oldName, newName] of Object.entries(DIR_RENAME)) {
    const from = join(dir, oldName), to = join(dir, newName);
    if (existsSync(from) && !existsSync(to)) { renameSync(from, to); changed = true; }
  }
  if (fixEmbeddedPaths(dir)) changed = true;
  if (changed) note(`✓ ${dir}：文件改名`);
  return changed;
}

function migrateIssues(data) {
  const root = join(data, "issues");
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue; // 006.json 这类单文件旧期跳过
    if (name === "legacy") continue; // legacy/ 保持原样
    migrateIssueDir(dir);
  }
}

function migrateFeedback(data) {
  const file = join(data, "feedback.jsonl");
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  if (!lines.length) return;
  const mapped = lines.map(line => {
    const row = JSON.parse(line);
    for (const key of ["favorite", "dislike"]) {
      if (typeof row[key] === "string" && PAGE_NAME_TO_ID[row[key]]) row[key] = PAGE_NAME_TO_ID[row[key]];
    }
    return JSON.stringify(row);
  });
  if (mapped.join("\n") !== lines.join("\n")) {
    writeFileSync(file, mapped.join("\n") + "\n");
    note(`✓ ${file}：favorite/dislike 换成 skill id`);
  }
}

// 四份旧档案整份搬进对应栏目的 state/<id>/config.md；已经搬过的（config.md 已存在）跳过
const ARCHIVE_TO_SKILL = { "creature-log.md": "creature", "story-bible.md": "story", "serial-bible.md": "serial-book", "think-log.md": "think" };

function migrateArchives(data) {
  for (const [oldFile, skill] of Object.entries(ARCHIVE_TO_SKILL)) {
    const from = join(data, oldFile);
    if (!existsSync(from)) continue;
    const dir = join(data, "state", skill), config = join(dir, "config.md"), logFile = join(dir, "log.jsonl");
    if (existsSync(config)) continue; // 已经迁过
    mkdirSync(dir, { recursive: true });
    renameSync(from, config);
    if (!existsSync(logFile)) writeFileSync(logFile, "");
    note(`✓ ${oldFile} → state/${skill}/config.md（历史内容原样保留；log.jsonl 从下一期开始正常追加）`);
  }
}

// profile.md 开头的称呼、刊名、send_note + voices/*.json 合并进新建的 magazine.yaml（已存在就跳过，不覆盖家长自己改过的）
function migrateMagazineYaml(data) {
  const target = join(data, "magazine.yaml");
  if (existsSync(target)) return;
  const profileFile = join(data, "profile.md");
  if (!existsSync(profileFile)) return;
  const profile = readFileSync(profileFile, "utf8");
  const field = re => profile.match(re)?.[1]?.trim();
  const call = field(/称呼[：:]\s*([^\n]+)/);
  const mastheadLine = field(/刊名[：:]\s*([^\n]+)/) ?? "";
  const by = mastheadLine.match(/[（(]([^）)]+)[）)]\s*$/)?.[1];
  const [zh, rest] = mastheadLine.replace(/[（(][^）)]+[）)]\s*$/, "").split(/[·.]/).map(s => s?.trim());
  const sendNote = field(/send_note[`」）][：:]?\s*([^\n]+)/) ?? field(/send_note\s*[：:]\s*([^\n]+)/);
  const voicesDir = join(data, "voices");
  const voiceFiles = existsSync(voicesDir) ? readdirSync(voicesDir).filter(f => f.endsWith(".json")) : [];
  const lines = [
    "# 杂志配置：由 scripts/migrate-v2.mjs 从 profile.md 和 voices/ 生成，请家长核对、按需调整",
    "masthead:",
    `  zh: ${zh ?? "待填"}`,
    `  en: ${rest ?? "待填"}`,
    ...(by ? [`  by: ${by}`] : []),
    call ? `call: ${call.split("/")[0].trim()}` : "call: 待填",
    sendNote ? `send_note: ${sendNote.replace(/[。.].*$/, "").trim()}` : "send_note: 待填",
    ...(voiceFiles.length ? [`# 讲读版声音配置仍在 voices/ 目录里按原有格式读取（${voiceFiles.join("、")}），不进 magazine.yaml 的 voices 字段：
# 这里的 voices 字段只支持每个角色一句话的简单声音名，现在这几个文件里按供应商、克隆、兜底写的配置更细，继续让 TTS 脚本直接读 voices/*.json`] : []),
  ];
  writeFileSync(target, lines.join("\n") + "\n");
  note(`✓ 生成 magazine.yaml（来自 profile.md 和 voices/，建议家长核对一遍再用）`);
}

function migrateCurriculum(data) {
  const from = join(data, "thinking-plan.md");
  const to = join(data, "curriculum", "thinking-plan.md");
  if (!existsSync(from) || existsSync(to)) return;
  mkdirSync(join(data, "curriculum"), { recursive: true });
  renameSync(from, to);
  note(`✓ thinking-plan.md → curriculum/thinking-plan.md`);
}

function main() {
  const dataArg = process.argv[2];
  if (!dataArg) { console.error("用法: node scripts/migrate-v2.mjs <数据目录>（只对副本跑，不要对着真实数据仓库直接跑）"); process.exit(2); }
  const data = resolve(dataArg);
  if (!existsSync(data)) { console.error(`${data} 不存在`); process.exit(2); }
  migrateIssues(data);
  migrateFeedback(data);
  migrateArchives(data);
  migrateMagazineYaml(data);
  migrateCurriculum(data);
  if (!log.length) console.log("没有要迁移的内容（已经是新格式，或者再跑一遍没有变化）");
}

main();
