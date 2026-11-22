#!/usr/bin/env node
// 在已安装角色的数据仓库里分派一天的工作。只有执行的开工锁会自动提交、推送。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, isoWeek, issueBriefs, loadAgent, localDate, planDay, readPlan, weekLayout } from "./plan.mjs";
import { createPipeline } from "./pipeline-lib.mjs";
import { isDate, isMap, isText, readJson } from "./topics.mjs";

const CLI = fileURLToPath(new URL("./pipeline.mjs", import.meta.url));
const SIX_HOURS = 6 * 60 * 60 * 1000;
const LOCK = ".lock";
const ROLES = ["editor", "producer"];
const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
const detail = result => (result.stderr || result.stdout || result.error?.message || "没有诊断输出").trim();
const requireGit = (cwd, ...args) => {
  const result = git(cwd, ...args);
  if (result.status !== 0) throw new Error(`git ${args[0]} 失败：${detail(result)}`);
  return result.stdout.trim();
};
const pull = cwd => git(cwd, "pull", "--rebase", "--autostash");

function options(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = args.slice(i, i + 2);
    if (!["--date", "--role"].includes(flag) || !value || flag in out)
      throw new Error("用法：sh .engine/scripts/run.sh [--date YYYY-MM-DD] [--role editor|producer]");
    out[flag] = value;
  }
  if (out["--date"] && !isDate(out["--date"])) throw new Error("--date 要是有效的 YYYY-MM-DD 日期");
  if (out["--role"] && !ROLES.includes(out["--role"])) throw new Error("--role 要是 editor 或 producer");
  return { today: out["--date"] ?? localDate(), role: out["--role"] };
}

function print({ action, role, date, week, issue, instructions = [], notify }) {
  const fields = Object.entries({ role, date, week, issue }).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`);
  console.log([`ACTION: ${action}`, ...fields].join(" "));
  if (instructions.length) console.log("\n" + instructions.join("\n"));
  if (notify) console.log("\nNOTIFY:\n" + notify);
}

function editTomorrow(data, today) {
  const date = addDays(today, 1), week = isoWeek(date), plan = readPlan(data, week);
  const base = { role: "editor", date, week };
  const template = `plan/${week}.json`;
  const finalize = [
    "处理新问题和家长的变更，选齐最近 7 天的新闻，核实来源并标记 ready。",
    `运行 \`node .engine/scripts/pipeline.mjs plan-check ${template}\`，通过后用 \`sh .engine/scripts/sync.sh push "plan: ${date} 定稿"\` 推送。`,
    `运行 \`node .engine/scripts/notify.mjs finalize ${date}\` 生成通知。`,
  ];
  if (!plan) return { ...base, action: "weekly-plan", instructions: [
    "1. 阅读 \`.engine/roles/editor.md\`，做本周策展。",
    `2. 排 ${week} 的七天选题和备用卡，写入 \`${template}\`。本周每天的主题和栏目（按 magazine.yaml 算好，有 check 的日子才写 check 卡）：`,
    ...weekLayout(data, week).map(d => `   - ${d.date} ${d.weekday}${d.theme ? ` ${d.theme}` : ""}：${d.sections.join("、")}`),
    `3. 运行 \`node .engine/scripts/pipeline.mjs plan-check ${template}\`，通过后用 \`sh .engine/scripts/sync.sh push "plan: ${week}"\` 推送。`,
    `4. 运行 \`node .engine/scripts/notify.mjs plan ${week}\` 生成通知。`,
    "5. 接着把明天定稿。", ...finalize.map(line => `   - ${line}`),
  ] };
  const started = issueBriefs(data).find(b => b.date === date);
  if (started) return { ...base, issue: started.issue, action: "none", instructions: ["明天已开工，选题卡已锁定。"] };
  if (planDay(plan, date)?.status === "ready") return { ...base, action: "none", instructions: ["明天已定稿。"] };
  return { ...base, action: "finalize", instructions: ["1. 阅读 \`.engine/roles/editor.md\`。", ...finalize.map((line, i) => `${i + 2}. ${line}`)] };
}

function readLock(data, issue) {
  const file = join(data, issue, LOCK);
  if (!existsSync(file)) return null;
  const lock = readJson(file);
  if (!isMap(lock) || lock.role !== "producer" || !isText(lock.by) || !isText(lock.host)
    || typeof lock.at !== "string" || !Number.isFinite(Date.parse(lock.at))) throw new Error(`${issue}/${LOCK} 格式有问题`);
  const commits = requireGit(data, "log", "-1", "--format=%ct", "--", issue);
  const time = Math.max(Date.parse(lock.at), Number(commits) * 1000);
  return { ...lock, expired: Date.now() - time > SIX_HOURS };
}

function blocked(base, lock) {
  return {
    ...base, action: "blocked",
    instructions: [`${lock.by} 正在制作这一期，本次无需开工。`],
    notify: `⏸️ 今日期刊正在制作\n第 ${base.issue.slice(-3)} 期已有人领取。`,
  };
}

function acquire(data, issue, name, old) {
  const branch = requireGit(data, "symbolic-ref", "HEAD");
  const [remote, ref] = requireGit(data, "for-each-ref", "--format=%(upstream:remotename)%00%(upstream:remoteref)", branch).split("\0");
  if (!remote || !ref) throw new Error("当前数据分支没有上游，无法推送开工锁");
  const head = requireGit(data, "rev-parse", "HEAD");
  const path = `${issue}/${LOCK}`, file = join(data, path);
  const current = readLock(data, issue);
  if (current && (!old || !current.expired || current.at !== old.at)) return { conflict: current };
  const previous = current ? readFileSync(file, "utf8") : null;
  const lock = { by: name, role: "producer", at: new Date().toISOString(), host: hostname() };
  const folder = dirname(file), created = !existsSync(folder);
  mkdirSync(folder, { recursive: true });
  try { writeFileSync(file, JSON.stringify(lock) + "\n", { flag: current ? "w" : "wx" }); }
  catch (error) {
    if (error.code === "EEXIST") return { conflict: readLock(data, issue) };
    throw error;
  }
  const restore = () => {
    if (previous !== null) writeFileSync(file, previous);
    else {
      rmSync(file, { force: true });
      if (created) try { rmdirSync(folder); }
      catch (error) { if (!["ENOTEMPTY", "ENOENT"].includes(error.code)) throw error; }
    }
  };
  // --only 只提交锁，即使仓库里已有其它暂存的稿件。
  const added = git(data, "add", "--", path);
  const committed = added.status === 0 ? git(data, "commit", "--only", "-m", `${issue.slice(-3)}: 领取出刊锁`, "--", path) : added;
  if (committed.status !== 0) {
    requireGit(data, "reset", "-q", "HEAD", "--", path);
    restore();
    throw new Error(`提交开工锁失败：${detail(committed)}`);
  }
  const lockCommit = requireGit(data, "rev-parse", "HEAD");
  const pushed = git(data, "push", remote, `${lockCommit}:${ref}`);
  if (pushed.status === 0) return {};
  // 只撤回这次取得锁的提交。保留其它文件的暂存区和工作树，再拉取赢家的锁。
  if (requireGit(data, "rev-parse", "HEAD") !== lockCommit) throw new Error(`推送开工锁失败，期间本地 HEAD 已变化：${detail(pushed)}`);
  requireGit(data, "reset", "--soft", head);
  requireGit(data, "reset", "-q", "HEAD", "--", path);
  restore();
  const pulled = pull(data);
  if (pulled.status !== 0) throw pullError(pulled);
  const winner = readLock(data, issue);
  if (winner?.at === lock.at && winner.by === lock.by && winner.host === lock.host) return {};
  if (winner && !winner.expired) return { conflict: winner };
  if (requireGit(data, "rev-parse", "HEAD") !== head) return { retry: true };
  throw new Error(`推送开工锁失败：${detail(pushed)}`);
}

function status(data, issue) {
  const result = spawnSync(process.execPath, [CLI, "status", issue], { cwd: data, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`读取 ${issue} 进度失败：${detail(result)}`);
  return result.stdout.trimEnd();
}

function produceToday(data, date, name, retry = true) {
  const briefs = issueBriefs(data), todays = briefs.filter(b => b.date === date);
  if (todays.length > 1) throw new Error(`${date} 有多份任务书：${todays.map(b => b.issue).join("、")}`);
  const today = todays[0], base = { role: "producer", date };
  const lockPath = issue => join(data, issue, LOCK);
  function takeLock(lock, fields) {
    const result = acquire(data, fields.issue, name, lock);
    if (result.conflict) return blocked(fields, result.conflict);
    if (result.retry) {
      if (retry) return produceToday(data, date, name, false);
      throw new Error("推送开工锁期间上游反复更新，请重跑");
    }
    return null;
  }
  if (today) {
    const { issue } = today, fields = { ...base, issue };
    if (createPipeline(join(data, issue)).archiveRecorded()) {
      const instructions = ["本期已归档。"];
      if (existsSync(lockPath(issue))) {
        rmSync(lockPath(issue));
        instructions.push('已删除遗留开工锁，请运行 `sh .engine/scripts/sync.sh push "清理出刊锁"`。');
      }
      return { ...fields, action: "none", instructions };
    }
    const lock = readLock(data, issue);
    const foreign = lock && (lock.by !== name || lock.host !== hostname());
    if (foreign && !lock.expired) return blocked(fields, lock);
    if (foreign) {
      const changed = takeLock(lock, fields);
      if (changed) return changed;
    }
    return { ...fields, action: "resume", instructions: [
      ...(foreign ? [`已接手 ${lock.by} 的过期开工锁。`] : []),
      "阅读 \`.engine/roles/producer.md\`，从下面未完成的步骤继续。",
      "", status(data, issue),
    ] };
  }

  // 只有 .lock 的目录是还未写任务书的占位，下一次触发继续检查这一期的锁。
  const existing = briefs.filter(b => b.brief || !existsSync(lockPath(b.issue)));
  const latest = existing.length ? Number(existing.at(-1).issue.slice(-3)) : 0;
  if (latest >= 999) throw new Error("下一期期号超过三位数字");
  const issue = `issues/${String(latest + 1).padStart(3, "0")}`, fields = { ...base, issue };
  const lock = readLock(data, issue);
  if (lock && !lock.expired) return blocked(fields, lock);
  const card = planDay(readPlan(data, isoWeek(date)), date);
  const changed = takeLock(lock, fields);
  if (changed) return changed;
  return { ...fields, action: "produce", instructions: [
    ...(lock ? [`已接手 ${lock.by} 的过期开工锁。`] : []),
    "1. 阅读 \`.engine/roles/producer.md\`。",
    `2. 运行 \`node .engine/scripts/pipeline.mjs schedule ${issue} ${date}\`，按任务书出刊。`,
    `3. 归档后推送回执，运行 \`node .engine/scripts/notify.mjs issue ${issue}\` 生成通知。`,
  ], notify: card?.status === "draft" ? "⚠️ 今天的选题没定稿，按周排草稿出刊" :
    !card ? "⚠️ 今天没有选题卡，执行自选（去重照样拦截）" : undefined };
}

function pullError(result) {
  const error = new Error(`拉取失败：${detail(result)}`);
  error.notify = "⚠️ 杂志数据同步失败\n今天的自动出刊任务暂时无法继续。";
  return error;
}

let flags = {};
try {
  flags = options(process.argv.slice(2));
  const data = requireGit(process.cwd(), "rev-parse", "--show-toplevel");
  const pulled = pull(data);
  if (pulled.status !== 0) throw pullError(pulled);
  const agent = loadAgent(data), roles = flags.role ? [flags.role] : agent.roles;
  if (!Array.isArray(roles) || !roles.length || roles.some(role => !ROLES.includes(role)))
    throw new Error("请在 .agent.yaml 配置 role: editor、producer 或 [editor, producer]，也可设置 KIDS_MAG_ROLE=editor,producer");
  for (const role of ROLES.filter(role => roles.includes(role))) {
    flags.role = role;
    print(role === "editor" ? editTomorrow(data, flags.today) : produceToday(data, flags.today, agent.name));
  }
} catch (error) {
  print({ action: "blocked", role: flags.role, date: flags.today, notify: error.notify });
  console.error(error.message);
  process.exitCode = 2;
}
