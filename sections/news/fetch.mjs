// 环球小报下载图片：3 张新闻照片放进 20-assets/news/news-1.jpg…（新闻原图只放私有数据目录）
//   node sections/news/fetch.mjs <issue> [<直链 1> <直链 2> <直链 3>]
//   不给直链就用 17-news.json 每条的 photo_url（要是图片直链）
//   fetchAssets(issueDir, { urls, get }) → { news: [...] }，路径相对 20-assets/，照抄进 assets.json
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assetDir, fetchImage } from "../../scripts/assets.mjs";

export const ID = "news";

export async function fetchAssets(issueDir, { urls, get = fetchImage } = {}) {
  const list = urls?.length ? urls : JSON.parse(readFileSync(path.join(issueDir, "17-news.json"), "utf8")).items.map(x => x.photo_url);
  const bad = list.map((u, i) => /^https?:\/\//.test(u ?? "") ? null : `第 ${i + 1} 条：${u}`).filter(Boolean);
  if (bad.length) throw new Error(`这些不是图片直链，在命令行给出直链：${bad.join("；")}`);
  const dir = assetDir(issueDir, ID), news = [];
  for (const [i, url] of list.entries()) {
    const f = `news-${i + 1}.jpg`;
    await get(url, path.join(dir, f), { min: 800, max: 1600 });
    news.push(`${ID}/${f}`);
  }
  return { news };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [issue, ...urls] = process.argv.slice(2);
  if (!issue) {
    console.error("用法：node sections/news/fetch.mjs <issue> [<直链 1> <直链 2> <直链 3>]");
    process.exit(2);
  }
  try {
    const r = await fetchAssets(issue, { urls });
    r.news.forEach(f => console.log(`✓ 20-assets/${f}`));
    console.log(`assets.json：${JSON.stringify(r)}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
