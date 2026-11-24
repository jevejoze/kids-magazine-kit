#!/usr/bin/env node
import { inputFingerprint } from "./build-state.mjs";
import { createPipeline } from "./pipeline-lib.mjs";
import { scheduleIssue } from "./schedule.mjs";
import { ticket } from "./ticket.mjs";
import { amendPlan, checkPlan, fallbackPlan } from "./plan.mjs";
const [, , cmd, issue, extraArg, ...rest] = process.argv;
if (!issue || !["plan-check", "plan-fallback", "plan-amend", "status", "schedule", "check", "assemble", "fingerprint", "video-inputs", "script", "archive", "ticket"].includes(cmd) || (cmd === "ticket" && !extraArg)) {
  console.error("用法: node pipeline.mjs <status|schedule|check|assemble|fingerprint|script|archive> <issue 目录>\n       node pipeline.mjs schedule <issue 目录> [YYYY-MM-DD]   第 00 步：按 magazine.yaml 和日期把本期栏目写进任务书\n       node pipeline.mjs ticket <issue 目录> <栏目|步骤|narration>   领任务单，指纹写进输出的 _meta.ticket\n       node pipeline.mjs plan-check <plan/YYYY-Www.json>\n       node pipeline.mjs plan-fallback <issue 目录> <cover|check|news> [新闻卡 id] <原因>\n       node pipeline.mjs plan-amend <issue 目录> <原因>   主编改了已开工那天的卡后，重新快照进任务书");
  process.exit(1);
}
try {
  if (cmd === "plan-check") {
    if (extraArg) throw new Error("用法：plan-check plan/YYYY-Www.json");
    const { errors, warnings } = checkPlan(issue);
    for (const warning of warnings) console.log(`警告：${warning}`);
    console.log(errors.length ? errors.join("\n") : "选题卡检查通过");
    process.exitCode = errors.length ? 2 : 0;
  } else if (cmd === "plan-fallback") {
    const news = extraArg === "news";
    if (rest.length !== (news ? 2 : 1)) throw new Error("用法：plan-fallback issues/NNN <cover|check|news> [新闻卡 id] <原因>");
    const { from, to, reason } = fallbackPlan(issue, extraArg, news ? rest[0] : null, rest.at(-1));
    console.log(`${extraArg} 降级：${from} → ${to}（${reason}）`);
  } else if (cmd === "plan-amend") {
    if (!extraArg || rest.length) throw new Error("用法：plan-amend issues/NNN <原因>");
    const { changed, dropped } = amendPlan(issue, extraArg);
    console.log(`已按新卡重新快照：${changed.length ? `改了 ${changed.join("、")}` : "卡没变"}${dropped.length ? `；作废的降级 ${dropped.join("、")}` : ""}`);
    console.log("执行先 git pull，再按 status 重做过期的步骤。");
  } else runIssueCommand();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}

function runIssueCommand() {
  const pipeline = createPipeline(issue);
  if (cmd === "ticket") {
    console.log(ticket(issue, extraArg).markdown);
  } else if (cmd === "schedule") {
    const brief = scheduleIssue(issue, extraArg);
    console.log(`${brief.date} ${brief.weekday_theme}：${Object.keys(brief.sections).join("、")}`);
    for (const [id, { params }] of Object.entries(brief.sections)) console.log(`  ${id.padEnd(10)} ${JSON.stringify(params)}`);
  } else if (cmd === "check") {
    const warnings = [], errors = pipeline.check({ warnings });
    for (const warning of warnings) console.log(`警告：${warning}`);
    console.log(errors.length ? errors.join("\n") : "全部通过");
    process.exitCode = errors.length ? 2 : 0;
  } else if (cmd === "video-inputs") {
    if (!["render", "audio"].every(stage => pipeline.done(stage))) throw new Error("页图或音频未完成、已过期，请重新制作后再合成视频");
    console.log(inputFingerprint(issue, "video"));
  } else if (cmd === "fingerprint") {
    console.log(pipeline.fingerprint());
  } else if (cmd === "script") {
    pipeline.script(extraArg);
  } else {
    pipeline[cmd]();
  }
}
