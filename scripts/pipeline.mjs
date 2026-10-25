#!/usr/bin/env node
import { inputFingerprint } from "./build-state.mjs";
import { createPipeline } from "./pipeline-lib.mjs";
const [, , cmd, issue] = process.argv;
if (!issue || !["status", "check", "assemble", "fingerprint", "video-inputs"].includes(cmd)) {
  console.error("用法: node pipeline.mjs <status|check|assemble|fingerprint> <issue 目录>");
  process.exit(1);
}
try {
  const pipeline = createPipeline(issue);
  if (cmd === "check") {
    const errors = pipeline.check();
    console.log(errors.length ? errors.join("\n") : "全部通过");
    process.exitCode = errors.length ? 2 : 0;
  } else if (cmd === "video-inputs") {
    if (!["40-render", "60-audio"].every(stage => pipeline.done(stage))) throw new Error("页图或音频未完成、已过期，请重新制作后再合成视频");
    console.log(inputFingerprint(issue, "70-video"));
  } else if (cmd === "fingerprint") console.log(pipeline.fingerprint());
  else pipeline[cmd]();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
