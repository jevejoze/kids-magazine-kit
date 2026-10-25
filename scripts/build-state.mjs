import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, rmSync, existsSync, statSync, readdirSync, cpSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { characterPackFiles } from "./character-pack.mjs";

const engine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hash = value => createHash("sha256").update(value).digest("hex");
const digestFile = path => existsSync(path) && statSync(path).isFile() ? hash(readFileSync(path)) : null;
const read = path => JSON.parse(readFileSync(path, "utf8"));
const engineFiles = (...paths) => paths.map(p => ["engine/" + p, join(engine, p)]);
const stages = read(join(engine, "pipeline/stages.json")).stages;

export function atomicWrite(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  try { writeFileSync(tmp, value); renameSync(tmp, path); }
  finally { rmSync(tmp, { force: true }); }
}

function sources(issue) {
  const brief = read(join(issue, "00-brief.json"));
  const files = stages.filter(s => Number(s.id.slice(0, 2)) <= 20 && (!s.when || brief[s.when] === true))
    .flatMap(s => s.outputs).filter(p => p.startsWith("issue/")).map(p => p.slice(6));
  // Track all downloaded assets, including replacements under the same filename.
  const assets = join(issue, "20-assets");
  if (existsSync(assets)) files.push(...readdirSync(assets, { recursive: true }).filter(f => statSync(join(assets, f)).isFile()).map(f => "20-assets/" + f));
  return [...new Set(files)].sort().map(p => [p, join(issue, p)]);
}

function snapshot(files) {
  return Object.fromEntries(files.map(([key, path]) => [key, digestFile(path)]));
}

export function contentFingerprint(issue) {
  issue = resolve(issue);
  return hash(JSON.stringify(snapshot([...sources(issue), ["30-issue.json", join(issue, "30-issue.json")]])));
}

export function inputFingerprint(issue, stage) {
  issue = resolve(issue);
  const local = (...files) => files.map(p => [p, join(issue, p)]);
  let files;
  if (stage === "30-assemble") files = [...sources(issue), ...engineFiles("scripts/pipeline-lib.mjs", "scripts/contracts.mjs", "pipeline/stages.json")];
  else if (stage === "40-render") files = [...sources(issue), ...local("30-issue.json", "31-review.md"),
    ...engineFiles("scripts/render.mjs", "scripts/contracts.mjs", "scripts/character-pack.mjs", "assets/template.html", "assets/style.css", "assets/characters.js"),
    ...characterPackFiles(read(join(issue, "30-issue.json")).character_pack).map(p => ["engine/" + relative(engine, p), p])];
  else if (stage === "60-audio") files = [...local("50-narration.json"),
    ["voices/azure.json", join(issue, "../../voices/azure.json")], ["voices/polyphones.json", join(issue, "../../voices/polyphones.json")],
    ...engineFiles("scripts/tts_azure.mjs", "scripts/polyphones.json")];
  else if (stage === "70-video") {
    const narration = read(join(issue, "50-narration.json")).narration;
    const sfx = new Set(["page", "bgm", ...narration.flatMap(p => p.lines.map(l => l.sfx)).filter(Boolean)]);
    files = [...local("30-issue.json", "31-review.md", "50-narration.json", "40-cards/build.json", "60-audio/build.json", "60-audio/manifest.json"),
      ...narration.flatMap(p => local(`40-cards/card-${p.card}.png`, ...p.lines.map((_, i) => `60-audio/c${p.card}_${String(i).padStart(2, "0")}.wav`))),
      ...readdirSync(join(issue, "40-cards")).filter(p => p.endsWith(".pdf")).flatMap(p => local("40-cards/" + p)),
      ...[...sfx].flatMap(name => ["wav", "mp3", "m4a", "ogg"].map(ext => [`sfx/${name}.${ext}`, join(issue, `../../sfx/${name}.${ext}`)])),
      ...engineFiles("scripts/make_video.py")];
  } else throw new Error(`不支持的制作步骤：${stage}`);
  files.push(...engineFiles("scripts/build-state.mjs"));
  return hash(JSON.stringify(snapshot(files)));
}

const receiptPath = (issue, stage, dir) => stage === "30-assemble" ? join(issue, "30-build.json") : join(dir || join(issue, { "40-render": "40-cards", "60-audio": "60-audio", "70-video": "70-final" }[stage]), "build.json");

export function recordBuild(issue, stage, inputs, outputs, dir) {
  if (inputs !== inputFingerprint(issue, stage)) throw new Error(`${stage} 制作期间输入发生变化，请重做`);
  const path = receiptPath(issue, stage, dir), base = dirname(path);
  const files = snapshot(outputs.map(p => [relative(base, p), p]));
  if (!Object.keys(files).length || Object.values(files).some(x => !x)) throw new Error(`${stage} 缺少输出文件`);
  atomicWrite(path, JSON.stringify({ stage, inputs, outputs: files }, null, 2) + "\n");
}

export function currentBuild(issue, stage, dir) {
  try {
    const path = receiptPath(issue, stage, dir), receipt = read(path);
    return receipt.stage === stage && receipt.inputs === inputFingerprint(issue, stage)
      && Object.keys(receipt.outputs).length > 0 && Object.entries(receipt.outputs).every(([p, expected]) => expected && digestFile(resolve(dirname(path), p)) === expected);
  } catch { return false; }
}

// Preserve unrelated notes; replace the complete set of generated files, with rollback on failure.
export function publishDirectory(staging, target, managed) {
  const backup = `${staging}.previous`;
  if (existsSync(target)) {
    for (const name of readdirSync(target)) if (!managed(name)) cpSync(join(target, name), join(staging, name), { recursive: true, errorOnExist: true, force: false });
    renameSync(target, backup);
  }
  try { renameSync(staging, target); }
  catch (error) { if (existsSync(backup)) renameSync(backup, target); throw error; }
  rmSync(backup, { recursive: true, force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , command, issue, stage, expected, staging] = process.argv;
  try {
    if (command === "fingerprint") console.log(inputFingerprint(issue, stage));
    else if (command === "finish-video") {
      const dir = resolve(staging);
      recordBuild(issue, "70-video", expected, readdirSync(dir).filter(p => p.endsWith(".mp4") || p.endsWith(".pdf")).map(p => join(dir, p)), dir);
      publishDirectory(dir, join(resolve(issue), "70-final"), name => name === "讲读版.mp4" || name === "build.json" || /-第\d+期\.pdf$/.test(name));
    } else throw new Error("用法：build-state.mjs fingerprint <issue> <stage> | finish-video <issue> 70-video <fingerprint> <staging>");
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
