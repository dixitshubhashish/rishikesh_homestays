#!/usr/bin/env node
// Writes the rh-i18n head snippet into every hand-made page (and thanks.html,
// whose head the generated stays pages copy on their next build):
//
//   node scripts/i18n/snippet.mjs          insert or refresh it
//   node scripts/i18n/snippet.mjs --check  exit 1 if a page lacks the current one
//
// The snippet goes right after the viewport meta. It reads the language
// (?lang=xx, else localStorage 'rh-lang', else English; never the browser
// language), sets <html lang> and dir, and for a language other than English
// hides the body (html.rh-i18n-wait, styles.css) for at most 1.5 s while
// assets/js/i18n-runtime.js translates the page.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./extract.mjs";
import { LANGS } from "./build-runtime.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RTL = ["he"];

export const SNIPPET =
  `<script>/* rh-i18n: page language, see assets/js/i18n-runtime.js */` +
  `(function(){var L=" ${LANGS.join(" ")} ",R=" ${RTL.join(" ")} ",d=document.documentElement,` +
  `m=/[?&]lang=([a-zA-Z-]{2,5})(?:[&#]|$)/.exec(location.search),l=m?m[1].toLowerCase():"";` +
  `if(m&&l!=="en"&&L.indexOf(" "+l+" ")<0)l="";` +
  `try{if(l)localStorage.setItem("rh-lang",l);else l=localStorage.getItem("rh-lang")||""}catch(e){}` +
  `if(L.indexOf(" "+l+" ")<0||l==="")return;` +
  `window.RH_LANG=l;d.lang=l;d.dir=R.indexOf(" "+l+" ")<0?"ltr":"rtl";d.classList.add("rh-i18n-wait");` +
  `setTimeout(function(){d.classList.remove("rh-i18n-wait")},1500);` +
  `var s=document.createElement("script");s.type="module";s.src="/assets/js/i18n-runtime.js";document.head.appendChild(s)})();</script>`;

const RE = /\n?[ \t]*<script>\/\* rh-i18n:[\s\S]*?<\/script>/;

export function withSnippet(html) {
  const indent = (html.match(/\n([ \t]*)<meta name="viewport"/) || [, "    "])[1];
  const clean = html.replace(RE, "");
  return clean.replace(/(<meta name="viewport"[^>]*>)/, `$1\n${indent}${SNIPPET}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  let bad = 0;
  for (const page of PAGES) {
    const file = join(ROOT, `${page}.html`);
    const html = readFileSync(file, "utf8");
    const next = withSnippet(html);
    if (!next.includes(SNIPPET)) { console.error(`${page}.html: no viewport meta to anchor the snippet`); bad++; continue; }
    if (next === html) continue;
    if (check) { console.error(`${page}.html: snippet missing or out of date`); bad++; }
    else { writeFileSync(file, next); console.log(`${page}.html: snippet written`); }
  }
  if (check && bad) process.exit(1);
}
