import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const template = readFileSync(new URL("../assets/template.html", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(template.match(/const chineseSegmenter[\s\S]*?(?=const CV =)/)[0], context);
const format = text => vm.runInContext(`wrapChineseWords(${JSON.stringify(text)})`, context);

test("cover questions keep numbers and their units on the same line", () => {
  for (const phrase of ["十二点", "12 点", "2 吨", "23.5度"]) {
    assert.ok(format(`半夜${phrase}，太阳还在天上？`).includes(`>${phrase}，</span>`));
  }
});

test("Chinese word boundaries preserve mummy and editorial line breaks", () => {
  const output = format("古埃及人做木乃伊，<br>那猫咪呢？");
  assert.ok(output.includes('>木乃伊，</span>'));
  assert.equal((output.match(/<br>/g) || []).length, 1);
  assert.equal(output.replace(/<span[^>]*>|<\/span>/g, ""), "古埃及人做木乃伊，<br>那猫咪呢？");
});

test("long cover credits wrap within the question column and stay clear of 200px characters", async t => {
  const { existsSync, mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  if (!chrome) return t.skip("Chrome unavailable");
  const dir = mkdtempSync(join(tmpdir(), "kids-cover-credit-"));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
  const css = readFileSync(new URL("../assets/style.css", import.meta.url), "utf8");
  const file = join(dir, "credit.html");
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${css}</style><section class="card photo-cover" id="c1"></section>
  <script>const card=document.querySelector('#c1'),rows=[];
  for(const count of [0,1,2]){
    card.innerHTML='<div class="cover-bottom'+(count?' has-crew':'')+'"><div class="q"><div class="t">半夜十二点，太阳为什么还在天上？</div></div>'+(count?'<div class="crew"><div class="chs">'+'<svg class="ch" width="200" height="200"></svg>'.repeat(count)+'</div></div>':'')+'<div class="credit en"></div></div>';
    const credit=card.querySelector('.credit');
    credit.textContent=('© A very long author name · Original work title · CC BY-SA 4.0. ').repeat(5)+'https://example.com/'+('unbroken-path-').repeat(20);
    const c=credit.getBoundingClientRect(),q=card.querySelector('.q').getBoundingClientRect(),crew=card.querySelector('.crew')?.getBoundingClientRect();
    rows.push({count,aligned:Math.abs(c.left-q.left)<1&&Math.abs(c.right-q.right)<1,
      clear:!crew||c.right+20<=crew.left,contained:credit.scrollWidth<=credit.clientWidth+1,
      wrapped:c.height>parseFloat(getComputedStyle(credit).lineHeight),
      sizes:[...card.querySelectorAll('.ch')].map(el=>el.getBoundingClientRect().width)});
  }
  document.body.insertAdjacentHTML('beforeend','<pre id="credit-result">'+JSON.stringify(rows)+'</pre>');</script>`);
  const dom = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${join(dir, "profile")}`, "--dump-dom", pathToFileURL(file).href], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 });
  const rows = JSON.parse(dom.match(/<pre id="credit-result">(\[[^<]+\])<\/pre>/)[1]);
  for (const row of rows) {
    assert.equal(row.aligned, true, `credit must share the question column (${row.count} roles)`);
    assert.equal(row.clear, true, "credit must not enter the character column");
    assert.equal(row.contained, true, "long names and URLs must not overflow");
    assert.equal(row.wrapped, true);
    assert.ok(row.sizes.every(width => width === 200), "spec dimensions must remain effective");
  }
});
