#!/usr/bin/env node
// Pulls the visible English text out of the generated footer-stays block
// (written by scripts/stays/footer_links.py, identical on every page) into
// i18n/footer/en.json as { "<English>": "<English>" }, keyed by the exact text.
//
//   node scripts/i18n/extract-footer.mjs            write i18n/footer/en.json
//   node scripts/i18n/extract-footer.mjs --stdout   print it instead
//
// Collected: every non-blank text node (headings, link labels, toggle labels)
// and aria-label / title / alt / placeholder attributes inside the block.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = join(ROOT, "thanks.html");
const OUT = join(ROOT, "i18n", "footer", "en.json");

const html = readFileSync(SOURCE, "utf8");
const m = html.match(/<!-- footer-stays -->([\s\S]*?)<!-- \/footer-stays -->/);
if (!m) {
  console.error("No <!-- footer-stays --> block found in thanks.html");
  process.exit(1);
}

const { document, NodeFilter } = new JSDOM(`<body>${m[1]}</body>`).window;
const norm = (s) => s.replace(/\s+/g, " ").trim();
const out = {};
const add = (s) => {
  const t = norm(s || "");
  if (t && /\p{L}/u.test(t)) out[t] = t;
};

const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
for (let n = walker.currentNode; n; n = walker.nextNode()) {
  if (n.nodeType === 3) add(n.nodeValue);
  else for (const a of ["aria-label", "title", "alt", "placeholder"]) if (n.hasAttribute(a)) add(n.getAttribute(a));
}

const json = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--stdout")) process.stdout.write(json);
else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  console.log(`Wrote ${Object.keys(out).length} labels to ${OUT}`);
}
