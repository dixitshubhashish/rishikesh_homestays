import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { parseSitemap, changedUrls, findKey } from '../../scripts/indexnow.mjs';

const xml = (rows) => `<urlset>${rows.map(([u, d]) => `<url>\n    <loc>${u}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`).join('')}</urlset>`;

test('IndexNow sends only pages added, re-dated or removed', () => {
  const before = parseSitemap(xml([['https://x/a', '2026-10-01'], ['https://x/b', '2026-10-01'], ['https://x/gone', '2026-09-01']]));
  const after = parseSitemap(xml([['https://x/a', '2026-10-01'], ['https://x/b', '2026-10-05'], ['https://x/new', '2026-10-05']]));
  assert.deepStrictEqual(changedUrls(before, after).sort(), ['https://x/b', 'https://x/gone', 'https://x/new']);
  assert.deepStrictEqual(changedUrls(after, after), []);
});

test('the IndexNow key file at the site root holds its own key', () => {
  assert.match(findKey(), /^[0-9a-f]{32}$/);
});

test('every sitemap URL is on our host (IndexNow rejects other hosts)', () => {
  for (const url of parseSitemap(readFileSync('sitemap.xml', 'utf-8')).keys()) {
    assert(url.startsWith('https://rishikeshhomestays.com/'), url);
  }
});
