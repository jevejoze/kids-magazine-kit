#!/usr/bin/env node
import { createPipeline } from "./pipeline-lib.mjs";
const [, , cmd, issue] = process.argv;
if (!issue || !["status", "check", "assemble"].includes(cmd)) {
  console.error("用法: node pipeline.mjs <status|check|assemble> <issue 目录>");
  process.exit(1);
}
try {
  const pipeline = createPipeline(issue);
  if (cmd === "check") {
    const errors = pipeline.check();
    console.log(errors.length ? errors.join("\n") : "全部通过");
    process.exitCode = errors.length ? 2 : 0;
  } else pipeline[cmd]();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
