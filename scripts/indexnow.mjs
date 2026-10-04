// IndexNow: tell Bing (which feeds ChatGPT search, Copilot, DuckDuckGo) and the
// other IndexNow engines which pages are new, changed or gone, so they recrawl
// them within minutes instead of whenever they next pass by. Google does not
// take part; it reads sitemap.xml.
//
// The key is public by design: the engines check that /<key>.txt on the site
// holds it, which proves we own the domain. Pages to send come from sitemap.xml:
// every URL whose <lastmod> moved (scripts/stays/page_dates.py keeps those dates
// honest) or that was added or removed since a git ref.
//
//   node scripts/indexnow.mjs --from <git ref>   pages changed since that commit
//   node scripts/indexnow.mjs --all              every page in the sitemap
//   add --wait-live to first wait until the live sitemap matches this one
//   (so the engines find the new pages, not the old deploy), --dry-run to only list.
//
// .github/workflows/indexnow.yml runs it after every push to main that changes sitemap.xml.
import { readFileSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HOST = 'rishikeshhomestays.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000; // the protocol's limit per request

export function findKey(dir = ROOT) {
  const file = readdirSync(dir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!file) throw new Error('no IndexNow key file (<32 hex>.txt) at the site root');
  const key = readFileSync(join(dir, file), 'utf-8').trim();
  if (`${key}.txt` !== file) throw new Error(`${file} should contain its own name's key`);
  return key;
}

/** sitemap.xml text -> Map(url -> lastmod) */
export function parseSitemap(xml) {
  const out = new Map();
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) out.set(m[1].trim(), (m[2] || '').trim());
  return out;
}

/** URLs added, re-dated or removed between two sitemaps (removed ones too: the engines then see the 404 or redirect). */
export function changedUrls(before, after) {
  const urls = [...after].filter(([u, d]) => before.get(u) !== d).map(([u]) => u);
  return urls.concat([...before.keys()].filter((u) => !after.has(u)));
}

const sitemapAt = (ref) => {
  try { return execFileSync('git', ['show', `${ref}:sitemap.xml`], { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; } // a ref without a sitemap (or the all-zero "before" of a new branch): everything is new
};

async function waitLive(local, minutes = 15) {
  const want = parseSitemap(local);
  for (const end = Date.now() + minutes * 60_000; Date.now() < end;) {
    try {
      const res = await fetch(`https://${HOST}/sitemap.xml`, { headers: { 'cache-control': 'no-cache' } });
      const live = parseSitemap(await res.text());
      if (changedUrls(live, want).length === 0) return;
    } catch { /* not reachable yet: keep waiting */ }
    await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error(`the live sitemap still differs from this one after ${minutes} minutes; not sending`);
}

async function main(argv) {
  const has = (f) => argv.includes(f);
  const local = readFileSync(join(ROOT, 'sitemap.xml'), 'utf-8');
  const from = argv[argv.indexOf('--from') + 1];
  if (!has('--all') && !(has('--from') && from)) throw new Error('say --all or --from <git ref>');
  const urls = has('--all') ? [...parseSitemap(local).keys()] : changedUrls(parseSitemap(sitemapAt(from)), parseSitemap(local));
  const key = findKey();
  console.log(`${urls.length} URL(s) to send${has('--dry-run') ? ' (dry run)' : ''}`);
  urls.slice(0, 20).forEach((u) => console.log(`  ${u}`));
  if (urls.length > 20) console.log(`  … and ${urls.length - 20} more`);
  if (!urls.length || has('--dry-run')) return;
  if (has('--wait-live')) await waitLive(local);
  const keyLive = await fetch(`https://${HOST}/${key}.txt`).then((r) => (r.ok ? r.text() : ''), () => '');
  if (keyLive.trim() !== key) throw new Error(`https://${HOST}/${key}.txt is not live yet; deploy it first`);
  for (let i = 0; i < urls.length; i += BATCH) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls.slice(i, i + BATCH) }),
    });
    // 200 = received, 202 = received, key check pending; 403 bad key, 422 URLs not on this host, 429 too often
    console.log(`IndexNow: HTTP ${res.status} for ${Math.min(BATCH, urls.length - i)} URL(s)`);
    if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow refused: ${res.status} ${await res.text()}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
