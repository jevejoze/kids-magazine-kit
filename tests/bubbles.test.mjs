import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

test("custom bubble tails do not stretch or inherit an extra border in Chrome", { skip: !chrome }, t => {
  const dir = mkdtempSync(join(tmpdir(), "kids-bubbles-"));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
  const css = ["../assets/style.css", "../sections/story/page.css", "../sections/challenge/page.css", "../sections/think/page.css"].map(f => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  const bubble = id => `<div class="bub" data-test="${id}">第一行对话<br>第二行对话</div>`;
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>
    <div id="story">${["owl", "raccoon", "general"].map(role => `<div class="act ${role}-act">${bubble(role)}</div>`).join("")}
      ${["mouse", "dog"].map(role => `<div class="duo-row ${role}-row">${bubble(role)}</div>`).join("")}</div>
    <div id="challenge"><div class="card"><div class="taunt">${bubble("challenge")}</div></div></div>
    <div id="think"><div class="card">${[0, 1].map(i => `<div class="side s${i}">${bubble("think" + i)}</div>`).join("")}</div></div>
    ${bubble("default")}
    <script>document.body.dataset.tails=JSON.stringify([...document.querySelectorAll('[data-test]')].map(el=>{
      const s=getComputedStyle(el,'::after');return {id:el.dataset.test,height:s.height,left:s.borderLeftWidth,
        right:s.borderRightWidth,bottom:s.borderBottomWidth,margin:s.marginLeft};
    }));</script>`;
  const file = join(dir, "bubbles.html");
  writeFileSync(file, html);
  const output = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${join(dir, "profile")}`, "--dump-dom", pathToFileURL(file).href], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 });
  const rows = JSON.parse(output.match(/data-tails="([^"]+)"/)[1].replaceAll("&quot;", '"'));
  for (const row of rows.filter(r => r.id !== "default")) {
    assert.equal(row.height, "0px", `${row.id}: tail must remain a triangle`);
    assert.equal(row.margin, "0px", `${row.id}: default negative margin must be cleared`);
    if (row.id.startsWith("think")) assert.equal(row.bottom, "0px");
    else if (row.id === "dog") { assert.equal(row.left, "9px"); assert.equal(row.right, "0px"); }
    else { assert.equal(row.left, "0px"); assert.notEqual(row.right, "0px"); }
  }
  assert.equal(rows.find(r => r.id === "default").bottom, "14px", "default tail remains unchanged");
});
