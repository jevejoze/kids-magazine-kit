import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/characters");
const roles = ["dog", "mouse", "owl", "raccoon"];
const moods = ["normal", "happy", "wave", "smirk", "sleepy", "angry", "surprise", "talk", "think"];

export function characterPackFiles(id) {
  if (id === undefined || id === null) return [];
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]*-v\d+$/.test(id)) throw new Error("角色素材库名称必须带版本，例如 storybook-v1");
  const manifestPath = join(root, id, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.id !== id || manifest.version !== Number(id.match(/-v(\d+)$/)[1])) throw new Error("角色素材库版本不一致");
  const atlases = Object.values(manifest.atlases ?? {});
  if (atlases.length !== roles.length || atlases.some(atlas => !/^[a-z0-9-]+\.png$/.test(atlas.file ?? ""))) throw new Error("四位角色的图集必须是素材库内的 PNG 文件");
  return [manifestPath, ...atlases.map(atlas => join(root, id, atlas.file))];
}

export function loadCharacterPack(id) {
  const files = characterPackFiles(id);
  if (!files.length) return null;
  const pack = JSON.parse(readFileSync(files[0], "utf8"));
  const images = {};
  for (const [key, atlas] of Object.entries(pack.atlases)) {
    const png = readFileSync(join(root, id, atlas.file));
    if (createHash("sha256").update(png).digest("hex") !== atlas.sha256) throw new Error(`角色素材库 ${id} 的图片已被修改；请另建新版本`);
    if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || png.readUInt32BE(16) !== atlas.width || png.readUInt32BE(20) !== atlas.height) throw new Error("角色图集尺寸与清单不一致");
    images[key] = `data:image/png;base64,${png.toString("base64")}`;
  }
  for (const name of roles) {
    const character = pack.characters?.[name];
    const atlas = pack.atlases[character?.atlas];
    if (!character || !atlas || character.eyes?.length !== 3 || character.top?.length !== 2) throw new Error(`角色 ${name} 缺少定位信息`);
    for (const mood of moods) {
      const frame = character.frames?.[mood];
      if (!Array.isArray(frame) || frame.length !== 4 || !frame.every(Number.isFinite) || frame[0] < 0 || frame[1] < 0 || frame[2] <= 0 || frame[3] <= 0 || frame[0] + frame[2] > atlas.width || frame[1] + frame[3] > atlas.height) throw new Error(`角色 ${name} 缺少有效表情 ${mood}`);
    }
  }
  return { ...pack, images };
}
