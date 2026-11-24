import test from "node:test";
import assert from "node:assert/strict";
import { serialCardOf } from "../scripts/contracts.mjs";

const base = { _order: ["cover", "comic", "news", "check", "serial", "mailbox"], cover: {}, comic: {}, check: {}, serial: { kind: "book" }, mailbox: {} };

test("经典版新闻占一张卡", () => {
  assert.equal(serialCardOf({ ...base, news: { items: [{}, {}, {}] } }), 5);
});

test("海报版新闻每条一张卡，连载页往后挪", () => {
  assert.equal(serialCardOf({ ...base, news: { layout: "poster", items: [{}, {}, {}] } }), 7);
  assert.equal(serialCardOf({ ...base, news: { layout: "poster", items: [{}, {}] } }), 6);
});

test("周五非读书连载返回 0", () => {
  assert.equal(serialCardOf({ ...base, news: { items: [] }, serial: { kind: "music" } }), 0);
});
