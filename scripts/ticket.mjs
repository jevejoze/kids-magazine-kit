// 任务单：做一个栏目（或讲读）之前领一张，里面是这一栏要守的规则、角色槽位、任务书字段、本期参数、状态文件、上游值和输出路径
//   ticket(issueDir, skill, { engine })   → { content, fingerprint, markdown }
//   skill：栏目 id（cover、story……或注册的栏目包）、步骤 id（13-story）、或 narration（第 50 步讲读稿）
//   指纹是 content 的 sha256；写进输出 JSON 的 _meta.ticket，任务单一变，status / check 就把这一步标成过期
//   validateCast(cast)、loadCast(dataDir, name, engine)   cast 包：槽位 → 角色
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY, loadMagazine, scheduledIn } from "./schedule.mjs";
import { loadSections } from "./sections.mjs";

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { stages } = JSON.parse(readFileSync(join(ENGINE, "pipeline", "stages.json"), "utf8"));
export const SLOTS = ["asker", "expert", "english", "trickster", "narrator"];
const ALWAYS = ["red-lines"];
const BRIEF_FIELDS = ["issue", "date", "weekday_theme", "english_level", "topic_hint", "child_question", "focus", "avoid", "last_feedback"];
// 讲读稿不是栏目，按能力领任务单
const CAPABILITIES = { narration: { stage: "50-narration", rules: ["narration", "no-visible-pedagogy"] } };

const isMap = v => v && typeof v === "object" && !Array.isArray(v);
const stable = v => Array.isArray(v) ? v.map(stable)
  : isMap(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const readJson = f => JSON.parse(readFileSync(f, "utf8"));

export function validateCast(cast) {
  if (!isMap(cast)) return ["cast 要是一个 JSON 对象"];
  const errors = [], chars = isMap(cast.characters) ? Object.keys(cast.characters) : [];
  if (chars.length < 2) errors.push(`cast 至少要 2 个角色，现在 ${chars.length} 个`);
  for (const [k, c] of Object.entries(cast.characters ?? {})) if (!isMap(c) || typeof c.name !== "string" || !c.name) errors.push(`角色 ${k} 缺 name`);
  for (const [k, c] of Object.entries(cast.characters ?? {})) if (isMap(c) && c.aliases !== undefined && !(Array.isArray(c.aliases) && c.aliases.every(a => typeof a === "string" && a))) errors.push(`角色 ${k} 的 aliases 要是字符串数组`);
  const slots = isMap(cast.slots) ? cast.slots : {};
  for (const s of SLOTS) {
    const who = slots[s];
    if (!who) errors.push(`槽位 ${s} 没人担`);
    else if (!chars.includes(who) && !(s === "narrator" && who === "narrator")) errors.push(`槽位 ${s} 填的 ${who} 不在 characters 里`);
  }
  const extra = Object.keys(slots).filter(s => !SLOTS.includes(s));
  if (extra.length) errors.push(`未知槽位：${extra.join("、")}（可写：${SLOTS.join("、")}）`);
  return errors;
}

// 数据目录 cast/<name>.json 优先，其次引擎 cast/<name>.json
export function loadCast(dataDir, name = "default", engine = ENGINE) {
  const file = [join(dataDir, "cast", `${name}.json`), join(engine, "cast", `${name}.json`)].find(existsSync);
  if (!file) throw new Error(`找不到 cast 包「${name}」（数据目录或引擎的 cast/${name}.json）`);
  const cast = readJson(file), errors = validateCast(cast);
  if (errors.length) throw new Error(`cast 包「${name}」有问题：\n- ${errors.join("\n- ")}`);
  return cast;
}

// 本刊用的 cast：magazine.yaml 的 cast，默认 default
export function magazineCast(dataDir, engine = ENGINE) {
  const { sections: registry } = loadSections({ engine, data: dataDir });
  return loadCast(dataDir, loadMagazine(dataDir, registry).cast ?? "default", engine);
}

// 栏目的声明：旧版页面看 LEGACY，栏目包看 manifest
function spec(skill, registry) {
  if (CAPABILITIES[skill]) return { id: skill, section: null, ...CAPABILITIES[skill], consumes: [], state: null, params: {} };
  const byStage = stages.find(s => s.id === skill);
  const id = byStage ? byStage.section ?? Object.keys(CAPABILITIES).find(k => CAPABILITIES[k].stage === skill) : skill;
  if (!id) throw new Error(`第 ${skill} 步不属于哪个栏目，没有任务单`);
  if (CAPABILITIES[id]) return spec(id, registry);
  const pack = registry.find(s => s.id === id);
  if (pack) {
    const m = pack.manifest, params = { ...(m.params ?? {}) };
    if (m.narration) params.narration_lines = { type: "number", default: m.narration.lines };
    return { id, section: id, pack: true, stage: stages.find(s => s.section === id)?.id ?? null, rules: m.rules ?? [], consumes: m.consumes ?? [], state: m.state ?? null, params };
  }
  if (LEGACY[id]) {
    const l = LEGACY[id];
    return { id, section: id, stage: l.stage, rules: l.rules ?? [], consumes: l.consumes ?? [], state: l.state ?? null, params: l.params };
  }
  throw new Error(`没有这个栏目：${skill}`);
}

// 状态文件：栏目包的 state/<id>/ 还没建（旧数据目录）时，沿用旧档案文件
export function stateFiles(sp, dataDir) {
  if (!sp.state) return [];
  const legacy = LEGACY[sp.id]?.state;
  const st = sp.pack && legacy && !existsSync(join(dataDir, "state", sp.id)) ? legacy : sp.state;
  return Object.values(st).map(f => `data/${f}`);
}

// 栏目的输出文件：有步骤就是步骤的 outputs，栏目包没有步骤就是 issue/<id>.json
const outputsOf = sp => sp.stage ? stages.find(s => s.id === sp.stage).outputs : [`issue/${sp.id}.json`];

export function ticket(issueDir, skill, { engine = ENGINE } = {}) {
  const issue = resolve(issueDir), dataDir = resolve(issue, "..", "..");
  const { sections: registry, errors } = loadSections({ engine, data: dataDir });
  if (errors.length) throw new Error(`栏目注册表有问题：\n- ${errors.join("\n- ")}`);
  const sp = spec(skill, registry);
  const briefFile = join(issue, "00-brief.json");
  if (!existsSync(briefFile)) throw new Error("还没有任务书 00-brief.json，先做第 00 步");
  const brief = readJson(briefFile);
  const magazine = loadMagazine(dataDir, registry);

  let params = {};
  if (sp.section) {
    if (scheduledIn(brief, sp.section) === false) throw new Error(`栏目 ${sp.section} 本期不出，没有任务单`);
    const defaults = Object.fromEntries(Object.entries(sp.params).map(([k, p]) => [k, p.default]));
    params = { ...defaults, ...(brief.sections?.[sp.section]?.params ?? {}) };
  }

  const ruleIds = [...new Set([...ALWAYS, ...sp.rules])];
  const rules = ruleIds.map(id => {
    const file = join(engine, "core", "rules", `${id}.md`);
    if (!existsSync(file)) throw new Error(`栏目 ${sp.id} 声明的规则不存在：${id}（core/rules/${id}.md）`);
    return { id, file: `core/rules/${id}.md`, text: readFileSync(file, "utf8") };
  });

  const cast = loadCast(dataDir, magazine.cast ?? "default", engine);

  const briefPart = Object.fromEntries(BRIEF_FIELDS.filter(k => brief[k] !== undefined).map(k => [k, brief[k]]));
  if (sp.section && isMap(brief[sp.section])) briefPart[sp.section] = brief[sp.section];

  // consumes：「栏目.字段」，到那个栏目的输出 JSON 里取
  const consumes = Object.fromEntries(sp.consumes.map(ref => {
    const [from, ...path] = ref.split(".");
    const source = spec(from, registry), file = outputsOf(source).find(p => p.endsWith(".json"));
    const f = join(issue, file.slice(6));
    if (!existsSync(f)) throw new Error(`要读的上游值 ${ref} 还没有：先做 ${source.stage ?? from}`);
    const value = path.reduce((v, k) => v?.[k], readJson(f));
    if (value === undefined) throw new Error(`上游 ${file} 里没有 ${path.join(".")}`);
    return [ref, value];
  }));

  const content = {
    skill: sp.id,
    stage: sp.stage,
    rules,
    cast: { id: cast.id ?? magazine.cast, slots: cast.slots, characters: cast.characters },
    brief: briefPart,
    params,
    state: stateFiles(sp, dataDir),
    consumes,
    output: outputsOf(sp),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(stable(content))).digest("hex");
  return { content, fingerprint, markdown: markdown(content, fingerprint) };
}

function markdown(c, fingerprint) {
  const name = k => c.cast.characters[k]?.name ?? (k === "narrator" ? "旁白" : k);
  const out = [
    `# 任务单 · ${c.skill}${c.stage ? `（第 ${c.stage.slice(0, 2)} 步）` : ""}`, "",
    "## 任务书", "", "```json", JSON.stringify(c.brief, null, 2), "```", "",
    "## 本期参数", "", Object.keys(c.params).length ? "```json\n" + JSON.stringify(c.params, null, 2) + "\n```" : "（无）", "",
    "## 角色槽位", "", ...Object.entries(c.cast.slots).map(([s, k]) => `- ${s}：${name(k)}（${k}）`), "",
  ];
  if (c.state.length) out.push("## 要读、要更新的状态", "", ...c.state.map(f => `- ${f}`), "");
  if (Object.keys(c.consumes).length) out.push("## 上游值", "", ...Object.entries(c.consumes).map(([k, v]) => `- ${k}：${JSON.stringify(v)}`), "");
  out.push("## 输出", "", ...c.output.map(f => `- ${f}`), "");
  for (const r of c.rules) out.push(`## 规则 · ${r.id}（${r.file}）`, "", r.text.trim().replace(/^# .*\n+/, ""), "");
  out.push(`指纹：${fingerprint}，写进输出的 _meta.ticket`);
  return out.join("\n");
}

// 输出文件属于哪张任务单：步骤的 section，第 50 步是 narration；不属于任何栏目返回 null
export function ticketSkillOf(file) {
  const s = stages.find(s => s.outputs.includes(`issue/${file}`));
  if (!s) return null;
  if (s.section) return s.section;
  return Object.keys(CAPABILITIES).find(k => CAPABILITIES[k].stage === s.id) ?? null;
}
