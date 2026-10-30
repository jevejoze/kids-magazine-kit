#!/usr/bin/env node
import { inputFingerprint } from "./build-state.mjs";
import { createPipeline } from "./pipeline-lib.mjs";
import { scheduleIssue } from "./schedule.mjs";
import { ticket } from "./ticket.mjs";
const [, , cmd, issue, extraArg] = process.argv;
if (!issue || !["status", "schedule", "check", "assemble", "fingerprint", "video-inputs", "script", "archive", "ticket"].includes(cmd) || (cmd === "ticket" && !extraArg)) {
  console.error("用法: node pipeline.mjs <status|schedule|check|assemble|fingerprint|script|archive> <issue 目录>\n       node pipeline.mjs schedule <issue 目录> [YYYY-MM-DD]   第 00 步：按 magazine.yaml 和日期把本期栏目写进任务书\n       node pipeline.mjs ticket <issue 目录> <栏目|步骤|narration>   领任务单，指纹写进输出的 _meta.ticket");
  process.exit(1);
}
try {
  const pipeline = createPipeline(issue);
  if (cmd === "ticket") {
    console.log(ticket(issue, extraArg).markdown);
  } else if (cmd === "schedule") {
    const brief = scheduleIssue(issue, extraArg);
    console.log(`${brief.date} ${brief.weekday_theme}：${Object.keys(brief.sections).join("、")}`);
    for (const [id, { params }] of Object.entries(brief.sections)) console.log(`  ${id.padEnd(10)} ${JSON.stringify(params)}`);
  } else if (cmd === "check") {
    const errors = pipeline.check();
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
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
