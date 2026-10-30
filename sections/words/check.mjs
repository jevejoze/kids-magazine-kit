// 单词屋的按页校验：check(words, ctx) → 问题列表（不带步骤前缀）
//   ctx.issue：本期目录（.../issues/NNN），用来找数据目录的 vocab.json 和本期期号
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

const words = s => String(s ?? "").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;

export function check(w, ctx) {
  const problems = [], need = (ok, msg) => { if (!ok) problems.push(msg); };
  const fields = (obj, keys) => keys.forEach(k => need(obj[k] !== undefined && obj[k] !== null && obj[k] !== "", `缺少字段 ${k}`));
  fields(w, ["intro", "grammar", "items", "task"]);
  need(w.items?.length === 3, "单词要 3 个");
  need(w.items?.some(x => x.new), "至少 1 个新词（new: true）");
  const dataDir = join(ctx.issue, "..", "..");
  const vocabFile = join(dataDir, "vocab.json");
  const vocab = existsSync(vocabFile) ? JSON.parse(readFileSync(vocabFile, "utf8")) : [];
  const self = Number(basename(ctx.issue));
  w.items?.forEach(x => {
    const n = words(x.example);
    need(n >= 8 && n <= 12, `${x.word} 的例句 ${n} 个词，要 8–12 个`);
    need(new RegExp(`\\b${x.word}`, "i").test(x.example), `${x.word} 的例句里没出现这个词`);
    const old = vocab.find(v => v.word.toLowerCase() === x.word.toLowerCase());
    need(!old || old.issue === self, `${x.word} 已经在第 ${old?.issue} 期学过`);
  });
  return problems;
}
