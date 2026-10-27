#!/usr/bin/env node
// Guard for the scheduled refresh (.github/workflows/stays-refresh.yml): the CI build has no local, git-ignored caches, and on
// 2026-10-26 it published Rishikesh with 1,697 stays instead of 2,844. This compares each built data module with the committed
// one (git HEAD, or --from <rev>) and exits 1 when a city lost more than MAX_DROP of its stays, so the bot does not commit it.
// Usage: node scripts/stays/stays-count-guard.mjs [--from <rev>] [--max-drop 0.1]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const FROM = arg('--from', 'HEAD');
const MAX_DROP = Number(arg('--max-drop', 0.1));
const MODULES = 'assets/js/modules';
const files = readdirSync(path.join(ROOT, MODULES)).filter((f) => /^stays-index-data(-[a-z]+)?\.js$/.test(f));
const tmp = mkdtempSync(path.join(tmpdir(), 'stays-guard-'));

async function count(file) {
  const m = await import(pathToFileURL(file).href + '?t=' + Date.now());
  return m.STAYS_INDEX.length;
}

let bad = 0;
for (const f of files) {
  let before;
  try {
    const old = execFileSync('git', ['show', `${FROM}:${MODULES}/${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
    const copy = path.join(tmp, f);
    writeFileSync(copy, old);
    before = await count(copy);
  } catch { console.log(`${f}: not in ${FROM}, skipped`); continue; }
  const after = await count(path.join(ROOT, MODULES, f));
  const drop = before ? (before - after) / before : 0;
  const flag = drop > MAX_DROP;
  if (flag) bad++;
  console.log(`${f}: ${before} -> ${after} (${(drop * 100).toFixed(1)}% ${drop >= 0 ? 'lost' : 'gained'})${flag ? '  TOO MANY LOST' : ''}`);
}
if (bad) { console.error(`stays-count-guard: ${bad} module(s) lost more than ${MAX_DROP * 100}% of their stays; not committing`); process.exit(1); }
