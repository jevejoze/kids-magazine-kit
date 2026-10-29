// 怪物卡下载图片：传说图和真身照片放进 20-assets/creature/
//   node sections/creature/fetch.mjs <issue> [<传说图直链> <照片直链>]
//   不给直链就用 09-creature.json 的 legend_url、photo_url（要是图片直链）
//   fetchAssets(issueDir, { legend, photo, get }) → { creature, creature_legend }，路径相对 20-assets/，照抄进 assets.json
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assetDir, fetchImage } from "../../scripts/assets.mjs";

export const ID = "creature";
const direct = (url, what) => {
  if (!/^https?:\/\//.test(url ?? "")) throw new Error(`${what}不是图片直链：${url}`);
  return url;
};

export async function fetchAssets(issueDir, { legend, photo, get = fetchImage } = {}) {
  const cr = legend && photo ? {} : JSON.parse(readFileSync(path.join(issueDir, "09-creature.json"), "utf8"));
  const dir = assetDir(issueDir, ID), rel = f => `${ID}/${f}`;
  await get(direct(legend ?? cr.legend_url, "传说图"), path.join(dir, "creature-legend.jpg"), { min: 800, max: 1600 });
  await get(direct(photo ?? cr.photo_url, "真身照片"), path.join(dir, "creature.jpg"), { min: 800, max: 1600 });
  return { creature: rel("creature.jpg"), creature_legend: rel("creature-legend.jpg") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [issue, legend, photo] = process.argv.slice(2);
  if (!issue) {
    console.error("用法：node sections/creature/fetch.mjs <issue> [<传说图直链> <照片直链>]");
    process.exit(2);
  }
  try {
    const r = await fetchAssets(issue, { legend, photo });
    console.log(`✓ 20-assets/${r.creature_legend}\n✓ 20-assets/${r.creature}`);
    console.log(`assets.json：${JSON.stringify(r)}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
