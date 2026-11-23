import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contentFingerprint } from "../scripts/build-state.mjs";

const command = fileURLToPath(new URL("../scripts/run.sh", import.meta.url));
const demo = new URL("../examples/demo/", import.meta.url);
const json = f => JSON.parse(readFileSync(f, "utf8"));
const put = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + "\n");
const git = (cwd, ...args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}\n${result.stderr}`);
  return result.stdout.trim();
};
const gitUser = root => {
  git(root, "config", "user.name", "测试");
  git(root, "config", "user.email", "test@example.org");
  git(root, "config", "commit.gpgSign", "false");
  git(root, "config", "core.hooksPath", ".git/hooks");
};
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "kids-next-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const remote = join(dir, "remote.git"), seed = join(dir, "seed");
  git(dir, "init", "--bare", "-b", "main", remote);
  git(dir, "clone", remote, seed);
  gitUser(seed);
  cpSync(demo, seed, { recursive: true, filter: src => !["cards", "audio", "final"].includes(basename(src)) });
  writeFileSync(join(seed, ".gitignore"), ".agent.yaml\nissues/*/cards/\n");
  const publish = message => {
    git(seed, "add", "--all");
    git(seed, "commit", "-m", message);
    git(seed, "push", "origin", "main");
  };
  publish("初始化示例");
  const clone = name => {
    const root = join(dir, name);
    git(dir, "clone", remote, root);
    gitUser(root);
    return root;
  };
  return { remote, seed, publish, clone };
}
function run(cwd, date, role, env = {}) {
  const config = { ...process.env };
  delete config.KIDS_MAG_ROLE;
  delete config.KIDS_MAG_AGENT;
  return spawnSync("sh", [command, "--date", date, ...(role ? ["--role", role] : [])], {
    cwd, encoding: "utf8", env: { ...config, ...env },
  });
}
function action(result, expected) {
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.stdout.split("\n")[0], `ACTION: ${expected}`);
}

test("周日排下周，拉取后按草稿定稿，定稿和开工后各自跳过", t => {
  const { seed, publish, clone } = fixture(t), root = clone("editor");
  const weekly = run(root, "2026-11-29", "editor");
  action(weekly, "weekly-plan role=editor date=2026-11-30 week=2026-W49");
  assert.match(weekly.stdout, /roles\/editor\.md[\s\S]+接着把明天定稿/);
  const path = join(seed, "plan/2026-W42.json"), plan = json(path), day = plan.days["2026-10-14"];
  rmSync(join(seed, "issues/003/brief.json"));
  day.status = "draft";
  put(path, plan);
  publish("推送草稿");
  const finalize = run(root, "2026-10-13", "editor");
  action(finalize, "finalize role=editor date=2026-10-14 week=2026-W42");
  assert.match(finalize.stdout, /plan-check[\s\S]+notify\.mjs finalize/);
  assert.equal(json(join(root, "plan/2026-W42.json")).days["2026-10-14"].status, "draft");
  day.status = "ready";
  put(path, plan);
  publish("推送定稿");
  action(run(root, "2026-10-13", "editor"), "none role=editor date=2026-10-14 week=2026-W42");
  put(join(seed, "issues/003/brief.json"), { issue: 3, date: "2026.10.14 周三" });
  day.status = "draft";
  put(path, plan);
  publish("执行提前开工");
  const locked = run(root, "2026-10-13", "editor");
  action(locked, "none role=editor date=2026-10-14 week=2026-W42 issue=issues/003");
  assert.match(locked.stdout, /已锁定/);
});

test("producer 开工推锁并区分 ready、draft、missing，重复触发不另起一期", async t => {
  for (const state of ["ready", "draft", "missing"]) await t.test(state, sub => {
    const { seed, remote, publish, clone } = fixture(sub), root = clone("producer"), path = join(seed, "plan/2026-W42.json");
    const plan = json(path);
    if (state !== "missing") plan.days["2026-10-15"] = { ...plan.days["2026-10-14"], status: state };
    else plan.curation = "无当日卡";
    put(path, plan);
    publish("推送当日排期");
    writeFileSync(join(root, "待续写.md"), "本地已有暂存稿");
    git(root, "add", "--", "待续写.md");
    const result = run(root, "2026-10-15", "producer", { KIDS_MAG_AGENT: "首位执行", KIDS_MAG_ROLE: "editor" });
    action(result, "produce role=producer date=2026-10-15 issue=issues/004");
    if (state === "ready") assert.doesNotMatch(result.stdout, /选题没定稿|没有选题卡/);
    // 前一天的 003 期没归档：提醒家长，但照常出今天这期
    assert.match(result.stdout, /第 003 期（2026-10-14）没有做完归档/);
    if (state === "draft") assert.match(result.stdout, /NOTIFY:\n.*按周排草稿出刊/);
    if (state === "missing") assert.match(result.stdout, /NOTIFY:\n.*今天没有选题卡/);
    const lock = JSON.parse(git(remote, "show", "main:issues/004/.lock"));
    assert.deepEqual(Object.keys(lock), ["by", "role", "at", "host", "date"]);
    assert.equal(lock.date, "2026-10-15");
    assert.equal(lock.by, "首位执行");
    assert.equal(lock.role, "producer");
    assert.equal(lock.host, hostname());
    assert.equal(git(remote, "show", "--pretty=format:", "--name-only", "main"), "issues/004/.lock");
    assert.equal(readFileSync(join(root, "待续写.md"), "utf8"), "本地已有暂存稿");

    // 同一个执行再次触发（上次中断、任务书还没写）：照常接着开工，不重领锁、不被自己挡住
    const commits = git(remote, "rev-list", "--count", "main");
    const self = run(root, "2026-10-15", "producer", { KIDS_MAG_AGENT: "首位执行" });
    action(self, "produce role=producer date=2026-10-15 issue=issues/004");
    assert.doesNotMatch(self.stdout, /接手/);
    assert.equal(git(remote, "rev-list", "--count", "main"), commits);

    const again = run(root, "2026-10-15", "producer", { KIDS_MAG_AGENT: "第二位执行" });
    action(again, "blocked role=producer date=2026-10-15 issue=issues/004");
    assert.match(again.stdout, /首位执行 正在制作/);
    assert.match(again.stdout, /NOTIFY:/);
    assert.equal(existsSync(join(root, "issues/005")), false);
  });
});

test("开工锁发生 push 竞态时拉取赢家，保留本地独立改动", t => {
  const { clone, remote } = fixture(t), winner = clone("winner"), loser = clone("loser");
  mkdirSync(join(winner, "issues/004"));
  put(join(winner, "issues/004/.lock"), { by: "另一个克隆", role: "producer", at: new Date().toISOString(), host: "remote" });
  git(winner, "add", "--", "issues/004/.lock");
  git(winner, "commit", "-m", "准备抢锁");
  const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
  writeFileSync(join(loser, ".git/hooks/pre-push"), `#!/bin/sh\ngit -C ${quote(winner)} push -q origin main\n`, { mode: 0o755 });
  writeFileSync(join(loser, "未完稿.md"), "要保留的内容");
  git(loser, "add", "--", "未完稿.md");
  const result = run(loser, "2026-10-15", "producer", { KIDS_MAG_AGENT: "落后者" });
  action(result, "blocked role=producer date=2026-10-15 issue=issues/004");
  assert.match(result.stdout, /另一个克隆 正在制作/);
  assert.equal(git(loser, "rev-parse", "HEAD"), git(remote, "rev-parse", "main"));
  assert.equal(readFileSync(join(loser, "未完稿.md"), "utf8"), "要保留的内容");
  assert.equal(json(join(loser, "issues/004/.lock")).by, "另一个克隆");
});

test("过期占位可以接手，已开工后 resume，有回执后在无页图的克隆里 none 并清理锁", t => {
  const { seed, publish, clone } = fixture(t), root = clone("producer");
  const resume = run(root, "2026-10-14", "producer");
  action(resume, "resume role=producer date=2026-10-14 issue=issues/003");
  assert.match(resume.stdout, /roles\/producer\.md[\s\S]+现在可以做：/);

  mkdirSync(join(seed, "issues/004"));
  const old = new Date(Date.now() - 7 * 3600e3).toISOString();
  put(join(seed, "issues/004/.lock"), { by: "先前执行", role: "producer", at: old, host: "remote" });
  git(seed, "add", "--", "issues/004/.lock");
  const committed = spawnSync("git", ["commit", "-m", "旧开工锁"], {
    cwd: seed, encoding: "utf8", env: { ...process.env, GIT_COMMITTER_DATE: old, GIT_AUTHOR_DATE: old },
  });
  assert.equal(committed.status, 0, committed.stderr);
  git(seed, "push");
  const takeover = run(root, "2026-10-15", "producer");
  action(takeover, "produce role=producer date=2026-10-15 issue=issues/004");
  assert.match(takeover.stdout, /接手 先前执行/);

  git(seed, "pull", "--rebase");
  const issue = join(seed, "issues/003");
  put(join(issue, ".lock"), { by: "原执行", role: "producer", at: new Date().toISOString(), host: "remote" });
  put(join(issue, "archive.json"), { issue: 3, content_hash: contentFingerprint(issue), updated: ["vocab.json"] });
  publish("归档回执尚带旧锁");
  const complete = run(root, "2026-10-14", "producer");
  action(complete, "none role=producer date=2026-10-14 issue=issues/003");
  assert.match(complete.stdout, /已删除遗留开工锁/);
  assert.equal(existsSync(join(root, "issues/003/cards")), false);
  assert.equal(existsSync(join(root, "issues/003/.lock")), false);
});

test("本机角色支持 YAML 和环境变量，拉取失败输出 NOTIFY 并返回 2", t => {
  const { clone } = fixture(t), root = clone("both");
  const unconfigured = run(root, "2026-10-14");
  assert.equal(unconfigured.status, 2);
  assert.match(unconfigured.stderr, /\.agent\.yaml.*KIDS_MAG_ROLE/);
  assert.equal(run(root, "2026-02-30", "editor").status, 2);
  writeFileSync(join(root, ".agent.yaml"), "role: [producer, editor]\nname: 本机编辑\n");
  const both = run(root, "2026-10-14");
  assert.equal(both.status, 0, both.stderr);
  assert.deepEqual(both.stdout.match(/^ACTION: .+/gm), [
    "ACTION: finalize role=editor date=2026-10-15 week=2026-W42",
    "ACTION: resume role=producer date=2026-10-14 issue=issues/003",
  ]);
  action(run(root, "2026-10-14", undefined, { KIDS_MAG_ROLE: "producer" }), "resume role=producer date=2026-10-14 issue=issues/003");
  git(root, "remote", "set-url", "origin", join(root, "unavailable.git"));
  const failed = run(root, "2026-10-14", "producer");
  assert.equal(failed.status, 2);
  assert.match(failed.stdout, /^ACTION: blocked role=producer date=2026-10-14[\s\S]+NOTIFY:\n.*同步失败/);
  assert.match(failed.stderr, /拉取失败/);
});

test("执行只推了锁（还没推任务书）时，主编也把那天当作已开工", t => {
  const { seed, publish, clone } = fixture(t), root = clone("editor");
  const path = join(seed, "plan/2026-W42.json"), plan = json(path);
  plan.days["2026-10-15"] = { ...plan.days["2026-10-14"], status: "draft" };
  put(path, plan);
  mkdirSync(join(seed, "issues/004"));
  put(join(seed, "issues/004/.lock"), { by: "执行", role: "producer", at: new Date().toISOString(), host: "remote", date: "2026-10-15" });
  publish("执行开工只推了锁");
  const locked = run(root, "2026-10-14", "editor");
  action(locked, "none role=editor date=2026-10-15 week=2026-W42 issue=issues/004");
  assert.match(locked.stdout, /已锁定/);
});

test("本地已归档但没推送：不判 none，提示先推送", t => {
  const { clone } = fixture(t), root = clone("producer");
  const issue = join(root, "issues/003");
  put(join(issue, "archive.json"), { issue: 3, content_hash: contentFingerprint(issue), updated: ["vocab.json"] });
  const pending = run(root, "2026-10-14", "producer");
  action(pending, "resume role=producer date=2026-10-14 issue=issues/003");
  assert.match(pending.stdout, /还没推送[\s\S]+sync\.sh push "003: 出刊"/);
});
