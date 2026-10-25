#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCharacterPack } from "./character-pack.mjs";

const [id = "storybook-v1", output = "output/character-preview/library.html"] = process.argv.slice(2);
const pack = loadCharacterPack(id);
if (!pack) throw new Error("请指定角色素材库版本");
const here = dirname(fileURLToPath(import.meta.url));
const labels = { normal: "平常", happy: "开心", wave: "招呼", smirk: "得意", sleepy: "困倦", angry: "生气", surprise: "惊讶", talk: "说话", think: "思考" };
const examples = [["dog", "surprise", "eyemask"], ["mouse", "happy", "scarf"], ["owl", "think", "magnifier"], ["raccoon", "smirk", "partyhat"], ["dogbox", "sleepy", ""], ["box", "peek", ""]];
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>团子编辑部 · 角色素材库</title>
<style>body{margin:0;padding:32px 40px;background:#fff9ee;color:#4a3b32;font-family:"PingFang SC",sans-serif}h1{margin:0;font-size:32px}header p{color:#877568;margin:10px 0 24px}.role{padding:14px 0;border-top:1px solid #ddc9b5}h2{font-size:20px;margin:0 0 6px}.grid{display:grid;grid-template-columns:repeat(9,1fr);gap:10px}figure{margin:0;text-align:center}figure svg{display:block;margin:0 auto}figcaption{font-size:13px;margin-top:2px;color:#877568}.props{display:flex;justify-content:space-around;background:#f5eddf;border-radius:16px;padding:12px}footer{font-size:13px;color:#877568;margin-top:16px}</style>
<header><h1>团子编辑部 · 固定角色素材库</h1><p>${id} · 四位成员 × 九种表情 · 每期复用同一批透明 PNG</p></header><main id="gallery"></main>
<script>const CHARACTER_PACK=${JSON.stringify(pack)};
${readFileSync(join(here, "../assets/characters.js"), "utf8")}
const labels=${JSON.stringify(labels)};
document.getElementById('gallery').innerHTML=Object.entries(CHARACTER_PACK.characters).map(([name, role])=>'<section class="role"><h2>'+role.name+'</h2><div class="grid">'+Object.keys(labels).map(mood=>'<figure>'+draw(name,mood,112)+'<figcaption>'+labels[mood]+'</figcaption></figure>').join('')+'</div></section>').join('')+'<section class="role"><h2>道具与场景组合</h2><div class="props">'+${JSON.stringify(examples)}.map(([name,mood,prop])=>'<figure>'+draw(name,mood,112,prop)+'</figure>').join('')+'</div></section>';
window.READY=characterPackReady;
</script><footer>此页展示固定头像素材；全身动作仍以 reference.png 设定板为后续制作参考。</footer></html>`;
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(output, html);
console.log(resolve(output));
