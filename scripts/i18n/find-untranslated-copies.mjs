// Finds entries in a language catalogue that are byte-identical to the English source
// (i18n:status only checks a key has *some* value, not that it differs from English, so
// these silently report "complete" while being untranslated). Writes job files in the same
// shape as sync.mjs jobs (one JSON array of {k, en, where} per <size> chars), split across
// numbered files, into its own isolated directory per language.
//
// Usage: node scripts/i18n/find-untranslated-copies.mjs <lang> <outDir> [--size N]
import { mkdirSync, writeFileSync } from 'node:fs';
import { readEn, readLang } from './catalog.mjs';

const [lang, outDir] = process.argv.slice(2);
const sizeArg = process.argv.indexOf('--size');
const SIZE = sizeArg >= 0 ? Number(process.argv[sizeArg + 1]) : 50000;
if (!lang || !outDir) throw new Error('usage: find-untranslated-copies.mjs <lang> <outDir> [--size N]');

const en = readEn();
const allEn = { ...en.site, ...en.stays };
const whereOf = (k) => (k in en.site ? 'site' : 'stays');
const tr = readLang(lang);

const bad = [];
for (const [k, v] of Object.entries(tr)) {
  if (typeof v !== 'string') continue;
  const e = allEn[k];
  if (e && v === e && /[A-Za-z]{4,}/.test(v)) bad.push({ k, en: e, where: whereOf(k) });
}

mkdirSync(outDir, { recursive: true });
let part = 0, chunk = [], chars = 0;
const flush = () => {
  if (!chunk.length) return;
  writeFileSync(`${outDir}/${lang}-${++part}.json`, JSON.stringify({ lang, items: chunk }, null, 1));
  chunk = []; chars = 0;
};
for (const it of bad) {
  if (chars + it.en.length > SIZE) flush();
  chunk.push(it); chars += it.en.length;
}
flush();
console.log(`${lang}: ${bad.length} untranslated-copy texts in ${part} file(s)`);
